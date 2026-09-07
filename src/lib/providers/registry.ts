import { PaymentProvider } from "./payment/types";
import { MockPaymentProvider } from "./payment/mock";
import { PaystackPaymentProvider } from "./payment/paystack";
import { KoraPayPaymentProvider } from "./payment/korapay";
import { NowPaymentsPaymentProvider } from "./payment/nowpayments";
import { DomainProvider } from "./domain/types";
import { MockDomainProvider } from "./domain/mock";
import { HostingProvider } from "./hosting/types";
import { MockHostingProvider } from "./hosting/mock";
import { DeploymentProviderAdapter } from "./deployment/types";
import { deploymentAdapterRegistry } from "./deployment/registry";
import { EmailProvider } from "./email/types";
import { MockEmailProvider } from "./email/mock";
import { ResendEmailProvider } from "./email/resend";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/security/encryption";
import { logger } from "@/lib/security/logger";

/**
 * Central lookup for provider adapters. Callers ask for "the payment
 * provider" and get back whatever is active/configured -- they never
 * reference a concrete vendor class directly. This is what makes swapping
 * Paystack for Stripe, or a mock registrar for a real one, a config change
 * instead of a rewrite.
 */

async function getCredential(adapterKey: string, type: string, key: string): Promise<string | null> {
  const provider = await prisma.provider.findFirst({
    where: { adapterKey, type: type as never, isActive: true },
    include: { credentials: true },
  });
  const cred = provider?.credentials.find((c) => c.key === key);
  if (!cred) return null;
  return decryptSecret(cred.encryptedValue);
}

// Cached mock provider instances are attached to `globalThis` (same pattern
// as the Prisma client in lib/db.ts, and MockPaymentProvider's own
// transaction Maps): Next.js compiles Server Actions and Route Handlers as
// separate bundles, each re-evaluating this module, so a plain module-level
// `let` would mean a mock provider created while handling a Server Action
// (e.g. checkout) and one created while handling a Route Handler (e.g. the
// payment webhook) could silently be two different instances with two
// different in-memory states.
declare global {
  var __cachedPaymentProvider: PaymentProvider | undefined;
  var __cachedDomainProvider: DomainProvider | undefined;
  var __cachedHostingProvider: HostingProvider | undefined;
  var __cachedEmailProvider: EmailProvider | undefined;
}

export async function getPaymentProvider(): Promise<PaymentProvider> {
  const preferred = process.env.PAYMENT_PROVIDER ?? "mock";
  if (preferred === "paystack") {
    const secretKey = process.env.PAYSTACK_SECRET_KEY || (await getCredential("paystack", "PAYMENT", "secretKey"));
    if (secretKey) return new PaystackPaymentProvider(secretKey);
  }
  if (preferred === "korapay") {
    const secretKey = process.env.KORAPAY_SECRET_KEY || (await getCredential("korapay", "PAYMENT", "secretKey"));
    if (secretKey) return new KoraPayPaymentProvider(secretKey);
  }
  if (preferred === "nowpayments") {
    const apiKey = process.env.NOWPAYMENTS_API_KEY || (await getCredential("nowpayments", "PAYMENT", "apiKey"));
    const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET || (await getCredential("nowpayments", "PAYMENT", "ipnSecret"));
    if (apiKey && ipnSecret) return new NowPaymentsPaymentProvider(apiKey, ipnSecret);
  }
  if (!global.__cachedPaymentProvider) global.__cachedPaymentProvider = new MockPaymentProvider();
  return global.__cachedPaymentProvider;
}

export async function getDomainProvider(): Promise<DomainProvider> {
  const preferred = process.env.DOMAIN_PROVIDER ?? "mock";
  // No real registrar adapter exists yet -- this branch is the seam where one
  // plugs in later (env credential or DB-stored ProviderCredential, decrypted,
  // exactly like PaystackPaymentProvider above), so adding it is a config
  // change here, not a call-site rewrite. Anything other than "mock" today
  // falls back to mock rather than failing the whole request.
  if (preferred !== "mock") {
    logger.warn("domain_provider.unimplemented_adapter_requested", { preferred });
  }
  if (!global.__cachedDomainProvider) global.__cachedDomainProvider = new MockDomainProvider();
  return global.__cachedDomainProvider;
}

export async function getHostingProvider(): Promise<HostingProvider> {
  const preferred = process.env.HOSTING_PROVIDER ?? "mock";
  // Same seam as getDomainProvider -- no real hosting adapter exists yet.
  if (preferred !== "mock") {
    logger.warn("hosting_provider.unimplemented_adapter_requested", { preferred });
  }
  if (!global.__cachedHostingProvider) global.__cachedHostingProvider = new MockHostingProvider();
  return global.__cachedHostingProvider;
}

/** Default/system-wide deployment adapter (used for the admin "test connection" check). Per-deployment resolution goes through deploymentAdapterRegistry keyed by DeploymentTarget.provider. */
export async function getDeploymentProvider(): Promise<DeploymentProviderAdapter> {
  return deploymentAdapterRegistry.resolve(process.env.DEPLOYMENT_PROVIDER ?? "mock");
}

export async function getEmailProvider(): Promise<EmailProvider> {
  const preferred = process.env.EMAIL_PROVIDER ?? "mock";
  if (preferred === "resend") {
    const apiKey = process.env.RESEND_API_KEY || (await getCredential("resend", "EMAIL", "apiKey"));
    if (apiKey) return new ResendEmailProvider(apiKey);
  }
  if (!global.__cachedEmailProvider) global.__cachedEmailProvider = new MockEmailProvider();
  return global.__cachedEmailProvider;
}
