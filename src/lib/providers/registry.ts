import { PaymentProvider } from "./payment/types";
import { MockPaymentProvider } from "./payment/mock";
import { PaystackPaymentProvider } from "./payment/paystack";
import { DomainProvider } from "./domain/types";
import { MockDomainProvider } from "./domain/mock";
import { HostingProvider } from "./hosting/types";
import { MockHostingProvider } from "./hosting/mock";
import { DeploymentProviderAdapter } from "./deployment/types";
import { deploymentAdapterRegistry } from "./deployment/registry";
import { EmailProvider } from "./email/types";
import { MockEmailProvider } from "./email/mock";
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

let cachedPaymentProvider: PaymentProvider | null = null;

export async function getPaymentProvider(): Promise<PaymentProvider> {
  const preferred = process.env.PAYMENT_PROVIDER ?? "mock";
  if (preferred === "paystack") {
    const secretKey = process.env.PAYSTACK_SECRET_KEY || (await getCredential("paystack", "PAYMENT", "secretKey"));
    if (secretKey) return new PaystackPaymentProvider(secretKey);
  }
  if (!cachedPaymentProvider) cachedPaymentProvider = new MockPaymentProvider();
  return cachedPaymentProvider;
}

let cachedDomainProvider: DomainProvider | null = null;
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
  if (!cachedDomainProvider) cachedDomainProvider = new MockDomainProvider();
  return cachedDomainProvider;
}

let cachedHostingProvider: HostingProvider | null = null;
export async function getHostingProvider(): Promise<HostingProvider> {
  if (!cachedHostingProvider) cachedHostingProvider = new MockHostingProvider();
  return cachedHostingProvider;
}

/** Default/system-wide deployment adapter (used for the admin "test connection" check). Per-deployment resolution goes through deploymentAdapterRegistry keyed by DeploymentTarget.provider. */
export async function getDeploymentProvider(): Promise<DeploymentProviderAdapter> {
  return deploymentAdapterRegistry.resolve(process.env.DEPLOYMENT_PROVIDER ?? "mock");
}

let cachedEmailProvider: EmailProvider | null = null;
export async function getEmailProvider(): Promise<EmailProvider> {
  if (!cachedEmailProvider) cachedEmailProvider = new MockEmailProvider();
  return cachedEmailProvider;
}
