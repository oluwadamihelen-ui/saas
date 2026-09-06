import { PaymentProvider } from "./payment/types";
import { MockPaymentProvider } from "./payment/mock";
import { PaystackPaymentProvider } from "./payment/paystack";
import { DomainProvider } from "./domain/types";
import { MockDomainProvider } from "./domain/mock";
import { HostingProvider } from "./hosting/types";
import { MockHostingProvider } from "./hosting/mock";
import { DeploymentProviderAdapter } from "./deployment/types";
import { MockDeploymentProvider } from "./deployment/mock";
import { EmailProvider } from "./email/types";
import { MockEmailProvider } from "./email/mock";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/security/encryption";

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
  if (!cachedDomainProvider) cachedDomainProvider = new MockDomainProvider();
  return cachedDomainProvider;
}

let cachedHostingProvider: HostingProvider | null = null;
export async function getHostingProvider(): Promise<HostingProvider> {
  if (!cachedHostingProvider) cachedHostingProvider = new MockHostingProvider();
  return cachedHostingProvider;
}

let cachedDeploymentProvider: DeploymentProviderAdapter | null = null;
export async function getDeploymentProvider(): Promise<DeploymentProviderAdapter> {
  if (!cachedDeploymentProvider) cachedDeploymentProvider = new MockDeploymentProvider();
  return cachedDeploymentProvider;
}

let cachedEmailProvider: EmailProvider | null = null;
export async function getEmailProvider(): Promise<EmailProvider> {
  if (!cachedEmailProvider) cachedEmailProvider = new MockEmailProvider();
  return cachedEmailProvider;
}
