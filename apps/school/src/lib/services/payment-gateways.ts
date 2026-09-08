import "server-only";
import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import type { PaymentGatewayProvider } from "@/generated/prisma/client";

export async function listGatewayCredentials(schoolId: string) {
  return prisma.paymentGatewayCredential.findMany({ where: { schoolId }, orderBy: { provider: "asc" } });
}

export interface SaveGatewayCredentialInput {
  provider: PaymentGatewayProvider;
  publicKey: string;
  /// Undefined keeps the existing secret unchanged (edit flow) — a school
  /// re-entering its public key or flipping "enabled" shouldn't have to
  /// paste the secret key back in every time.
  secretKey?: string;
  webhookSecret?: string;
  isEnabled: boolean;
}

export async function saveGatewayCredential(schoolId: string, input: SaveGatewayCredentialInput) {
  const existing = await prisma.paymentGatewayCredential.findUnique({
    where: { schoolId_provider: { schoolId, provider: input.provider } },
  });
  if (!existing && !input.secretKey) {
    throw new Error("Enter the secret key to connect this gateway.");
  }

  return prisma.paymentGatewayCredential.upsert({
    where: { schoolId_provider: { schoolId, provider: input.provider } },
    create: {
      schoolId,
      provider: input.provider,
      publicKey: input.publicKey,
      secretKeyEnc: encryptSecret(input.secretKey!),
      webhookSecretEnc: input.webhookSecret ? encryptSecret(input.webhookSecret) : null,
      isEnabled: input.isEnabled,
    },
    update: {
      publicKey: input.publicKey,
      ...(input.secretKey ? { secretKeyEnc: encryptSecret(input.secretKey) } : {}),
      ...(input.webhookSecret !== undefined ? { webhookSecretEnc: input.webhookSecret ? encryptSecret(input.webhookSecret) : null } : {}),
      isEnabled: input.isEnabled,
    },
  });
}

/// Disconnecting the school's currently *active* provider clears
/// activePaymentProvider too, so "Pay online" falls back to the mock
/// gateway instead of pointing at credentials that no longer exist.
export async function removeGatewayCredential(schoolId: string, provider: PaymentGatewayProvider) {
  await prisma.paymentGatewayCredential.deleteMany({ where: { schoolId, provider } });
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { activePaymentProvider: true } });
  if (school?.activePaymentProvider === provider) {
    await prisma.school.update({ where: { id: schoolId }, data: { activePaymentProvider: null } });
  }
}

export async function setActivePaymentProvider(schoolId: string, provider: PaymentGatewayProvider | null) {
  if (provider) {
    const credential = await prisma.paymentGatewayCredential.findUnique({
      where: { schoolId_provider: { schoolId, provider } },
    });
    if (!credential || !credential.isEnabled) throw new Error("Connect and enable this gateway before making it active.");
  }
  return prisma.school.update({ where: { id: schoolId }, data: { activePaymentProvider: provider } });
}
