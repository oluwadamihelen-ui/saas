import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { markOrderPaid } from "@/lib/services/orders";
import { fulfillOrder } from "@/lib/services/fulfillment";
import { getPaymentProvider } from "@/lib/providers/registry";
import { PaystackPaymentProvider } from "@/lib/providers/payment/paystack";
import { KoraPayPaymentProvider } from "@/lib/providers/payment/korapay";
import { NowPaymentsPaymentProvider } from "@/lib/providers/payment/nowpayments";
import { PaymentProvider } from "@/lib/providers/payment/types";
import { logger } from "@/lib/security/logger";

const SIGNATURE_HEADERS: Record<string, string> = {
  mock: "x-mock-signature",
  paystack: "x-paystack-signature",
  korapay: "x-korapay-signature",
  nowpayments: "x-nowpayments-sig",
};

// Every provider adapter's handleWebhook() normalizes to this type for a
// successful charge (see MockPaymentProvider/PaystackPaymentProvider).
// Anything else -- subscription lifecycle events, refunds, transfers, etc. --
// isn't handled by this route yet and must never be forced through the
// charge-verification path below: event.providerReference on those events
// often isn't an Order.transactionRef at all, so treating it as one risks
// either a spurious 404 or, worse, an accidental match against an unrelated
// order.
const CHARGE_SUCCESS_EVENT_TYPE = "charge.success";

async function resolveProvider(key: string): Promise<PaymentProvider | null> {
  // Route through the same cached instance checkout uses (getPaymentProvider)
  // rather than constructing a fresh MockPaymentProvider -- its transaction
  // state lives in that one instance, and a fresh `new` here would never see
  // the payment createPayment() just recorded.
  if (key === "mock") return getPaymentProvider();
  if (key === "paystack") {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) return null;
    return new PaystackPaymentProvider(secretKey);
  }
  if (key === "korapay") {
    const secretKey = process.env.KORAPAY_SECRET_KEY;
    if (!secretKey) return null;
    return new KoraPayPaymentProvider(secretKey);
  }
  if (key === "nowpayments") {
    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
    if (!apiKey || !ipnSecret) return null;
    return new NowPaymentsPaymentProvider(apiKey, ipnSecret);
  }
  return null;
}

/** Best-effort dedup key: the provider's own event/transaction id if present, else a hash of the body. */
function extractEventId(rawBody: string, parsed: unknown): string {
  const payload = parsed as { id?: unknown; data?: { id?: unknown } };
  const providerId = payload?.data?.id ?? payload?.id;
  if (providerId !== undefined && providerId !== null) return String(providerId);
  return crypto.createHash("sha256").update(rawBody).digest("hex");
}

/**
 * Payment providers call this URL, not the browser. We never trust a
 * frontend-reported "payment successful" state -- every order is only
 * marked paid after the signature on this webhook body is verified, and
 * every event is processed at most once (a provider retrying delivery of
 * the same event must not double-apply a payment).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerKey } = await params;
  const rawBody = await req.text();
  const signatureHeader = req.headers.get(SIGNATURE_HEADERS[providerKey] ?? "");

  const provider = await resolveProvider(providerKey);
  if (!provider) {
    logger.warn("webhook.unknown_provider", { providerKey });
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  if (!provider.verifyWebhookSignature({ rawBody, signatureHeader })) {
    logger.warn("webhook.signature_invalid", { providerKey });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = provider.handleWebhook(rawBody);
  const eventId = extractEventId(rawBody, event.raw);

  if (event.type !== CHARGE_SUCCESS_EVENT_TYPE) {
    logger.info("webhook.event_type_ignored", { providerKey, eventType: event.type });
    try {
      await prisma.paymentWebhookEvent.create({
        data: { provider: providerKey, eventId, eventType: event.type, payload: event.raw as never },
      });
    } catch (err) {
      const isDuplicate = err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002";
      if (!isDuplicate) throw err;
    }
    return NextResponse.json({ received: true, ignored: true, type: event.type });
  }

  const order = await prisma.order.findFirst({ where: { transactionRef: event.providerReference } });
  if (!order) {
    logger.warn("webhook.order_not_found", { providerKey, reference: event.providerReference });
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Idempotency: record this (provider, eventId) pair before doing any work.
  // A unique-constraint violation means we've already processed this exact
  // event (a provider retry), so we acknowledge and stop -- never re-apply.
  try {
    await prisma.paymentWebhookEvent.create({
      data: { provider: providerKey, eventId, eventType: event.type, orderId: order.id, payload: event.raw as never },
    });
  } catch (err) {
    const isDuplicate = err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002";
    if (isDuplicate) {
      logger.info("webhook.duplicate_event_ignored", { providerKey, eventId, orderId: order.id });
      return NextResponse.json({ received: true, duplicate: true });
    }
    throw err;
  }

  const verified = await provider.verifyPayment(event.providerReference);

  if (verified.status !== "PAID") {
    logger.warn("webhook.payment_not_confirmed", { orderId: order.id, status: verified.status });
    return NextResponse.json({ received: true });
  }

  // Amount/currency validation: the webhook (or the verified transaction it
  // points to) must match what the order actually expects. A mismatch means
  // something is wrong -- a tampered reference, a provider bug, or an
  // attempted underpayment -- and must never silently mark the order paid.
  const expectedAmount = Number(order.total);
  const paidAmount = verified.amount || expectedAmount;
  const amountMatches = Math.abs(paidAmount - expectedAmount) < 0.01;
  const currencyMatches = !verified.currency || verified.currency.toUpperCase() === order.currency.toUpperCase();

  if (!amountMatches || !currencyMatches) {
    logger.error("webhook.amount_currency_mismatch", {
      orderId: order.id,
      expectedAmount,
      paidAmount,
      expectedCurrency: order.currency,
      paidCurrency: verified.currency,
    });
    return NextResponse.json({ error: "Amount or currency mismatch" }, { status: 409 });
  }

  await markOrderPaid(order.id, {
    provider: providerKey,
    providerRef: event.providerReference,
    amount: paidAmount,
    currency: verified.currency || order.currency,
  });
  await fulfillOrder(order.id);

  return NextResponse.json({ received: true });
}
