import "server-only";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { mockPaymentProvider } from "./mock-provider";
import { paystackProvider } from "./paystack-provider";
import { flutterwaveProvider } from "./flutterwave-provider";
import { korapayProvider } from "./korapay-provider";
import type { GatewayCredentials, PaymentProvider } from "./types";
import type { PaymentGatewayProvider } from "@/generated/prisma/client";

const PROVIDERS: Record<PaymentGatewayProvider, PaymentProvider> = {
  PAYSTACK: paystackProvider,
  FLUTTERWAVE: flutterwaveProvider,
  KORAPAY: korapayProvider,
};

export function getProviderAdapter(name: PaymentGatewayProvider): PaymentProvider {
  return PROVIDERS[name];
}

export interface ResolvedProvider {
  provider: PaymentProvider;
  providerName: PaymentGatewayProvider | null;
  credentials?: GatewayCredentials;
}

/// Looks up one specific gateway's stored, decrypted credentials for a
/// school. Used both to resolve a school's currently *active* provider
/// (below) and, separately, to re-resolve whichever provider a specific
/// past payment recorded — so a school switching its active gateway
/// later never changes how an in-flight payment gets verified.
export async function resolveCredentialedProvider(
  schoolId: string,
  providerName: PaymentGatewayProvider
): Promise<ResolvedProvider | null> {
  const credential = await prisma.paymentGatewayCredential.findUnique({
    where: { schoolId_provider: { schoolId, provider: providerName } },
  });
  if (!credential || !credential.isEnabled) return null;

  return {
    provider: PROVIDERS[providerName],
    providerName,
    credentials: { publicKey: credential.publicKey, secretKey: decryptSecret(credential.secretKeyEnc) },
  };
}

/// Resolves which gateway "Pay online" should use for a school right
/// now. Falls back to the built-in mock/simulated gateway (providerName:
/// null) when the school hasn't connected and activated a real one, so
/// online payments work with zero setup — connecting a real gateway is
/// purely additive.
export async function resolvePaymentProvider(schoolId: string): Promise<ResolvedProvider> {
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { activePaymentProvider: true } });
  if (school?.activePaymentProvider) {
    const resolved = await resolveCredentialedProvider(schoolId, school.activePaymentProvider);
    if (resolved) return resolved;
  }
  return { provider: mockPaymentProvider, providerName: null };
}
