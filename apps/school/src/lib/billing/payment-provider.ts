import "server-only";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { paystackProvider } from "@/lib/payments/paystack-provider";
import { notifySubscriptionPaymentSuccess } from "@/lib/services/notifications";
import type { GatewayCredentials, PaymentProvider } from "@/lib/payments/types";
import type { PaymentGatewayProvider } from "@/generated/prisma/client";

/// Winfield's OWN merchant credentials — schools pay Winfield through
/// this, which is a different thing entirely from PaymentGatewayCredential
/// (a school's own keys for collecting fees from ITS parents). Read once
/// from env, never stored per-school and never encrypted at rest here
/// (there's exactly one pair, for this one deployment, same as any other
/// server-side API secret).
function getPlatformPaystackCredentials(): GatewayCredentials | null {
  const publicKey = process.env.PLATFORM_PAYSTACK_PUBLIC_KEY;
  const secretKey = process.env.PLATFORM_PAYSTACK_SECRET_KEY;
  if (!publicKey || !secretKey) return null;
  return { publicKey, secretKey };
}

/// Mirrors mock-provider.ts's simulated round trip (initialize sends the
/// payer straight to our own confirm page; verify reads back whatever
/// confirmSubscriptionPayment already wrote to the invoice) so platform
/// billing works end-to-end with zero external setup in dev/demo — same
/// reasoning as every other payment flow in this app never requiring real
/// credentials to function.
const platformMockProvider: PaymentProvider = {
  name: "mock",
  async initialize({ reference, callbackUrl }) {
    return { authorizationUrl: `${callbackUrl}?reference=${reference}` };
  },
  async verify(reference) {
    const invoice = await prisma.platformInvoice.findUnique({ where: { providerReference: reference } });
    if (!invoice) return { status: "failed", amountMinor: 0 };
    const status = invoice.status === "PAID" ? "success" : invoice.status === "VOID" ? "failed" : "pending";
    return { status, amountMinor: invoice.amountMinor };
  },
};

interface ResolvedPlatformProvider {
  provider: PaymentProvider;
  providerName: PaymentGatewayProvider | null;
  credentials?: GatewayCredentials;
}

function resolvePlatformProvider(): ResolvedPlatformProvider {
  const credentials = getPlatformPaystackCredentials();
  if (credentials) return { provider: paystackProvider, providerName: "PAYSTACK", credentials };
  return { provider: platformMockProvider, providerName: null };
}

/// Starts an online payment against one of the school's own PENDING
/// PlatformInvoice rows (spec: schools pay Winfield for their
/// subscription). payerEmail is the staff member actually doing the
/// paying — the school itself has no login/email of its own to charge.
export async function initializeSubscriptionPayment(schoolId: string, invoiceId: string, payerEmail: string, callbackUrl: string) {
  const invoice = await prisma.platformInvoice.findFirst({ where: { id: invoiceId, schoolId } });
  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status === "PAID") throw new Error("This invoice is already paid.");
  if (invoice.status === "VOID") throw new Error("This invoice is no longer valid — refresh the page for your current balance.");

  const { provider, providerName, credentials } = resolvePlatformProvider();
  const reference = crypto.randomBytes(12).toString("hex");

  await prisma.platformInvoice.update({
    where: { id: invoice.id },
    data: { provider: providerName, providerReference: reference },
  });

  const { authorizationUrl } = await provider.initialize(
    { amountMinor: invoice.amountMinor, currency: invoice.currency, reference, callbackUrl, payerEmail },
    credentials
  );
  return { authorizationUrl };
}

/// Confirms a platform invoice payment — called from the confirm page
/// (mock/redirect flow) and from the webhook alike, both idempotent. Never
/// trusts the redirect alone for a real gateway: verifies server-side
/// against Paystack's own API first, exactly like confirmOnlinePayment
/// does for parent-facing payments.
export async function confirmSubscriptionPayment(reference: string) {
  const invoice = await prisma.platformInvoice.findUnique({ where: { providerReference: reference }, include: { subscription: { include: { plan: true } } } });
  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status === "PAID") return invoice;

  if (invoice.provider) {
    const credentials = getPlatformPaystackCredentials();
    if (!credentials) throw new Error("Winfield's payment gateway is not configured — contact support.");
    const result = await paystackProvider.verify(reference, credentials);
    if (result.status !== "success") return invoice;
  }

  const updated = await prisma.platformInvoice.update({ where: { id: invoice.id }, data: { status: "PAID", paidAt: new Date() } });

  // A successful payment clears any PAST_DUE grace window and puts the
  // subscription plainly back to ACTIVE — a school that pays doesn't stay
  // flagged past-due until the next lazy reconciliation happens to run.
  await prisma.subscription.update({
    where: { id: invoice.subscriptionId },
    data: { status: "ACTIVE", pastDueSince: null, graceEndsAt: null },
  });

  await notifySubscriptionPaymentSuccess(invoice.schoolId, invoice.subscription.plan.name);
  return updated;
}
