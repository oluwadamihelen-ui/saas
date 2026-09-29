import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/security/encryption";
import { recordAuditLog } from "@/lib/security/audit";
import type { PaymentProviderType } from "@/generated/prisma/enums";

export interface PaymentSettingsView {
  activeProvider: PaymentProviderType | null;
  paystack: { configured: boolean; publicKey: string | null };
  flutterwave: { configured: boolean; publicKey: string | null; webhookHashSet: boolean };
  korapay: { configured: boolean; publicKey: string | null };
}

/** Never returns decrypted secret keys -- only whether one is on file, plus the public keys (safe to display). */
export async function getPaymentSettingsView(hotelId: string): Promise<PaymentSettingsView> {
  const s = await prisma.hotelPaymentSettings.findUnique({ where: { hotelId } });
  return {
    activeProvider: s?.activeProvider ?? null,
    paystack: { configured: Boolean(s?.paystackSecretKeyEnc), publicKey: s?.paystackPublicKey ?? null },
    flutterwave: { configured: Boolean(s?.flutterwaveSecretKeyEnc), publicKey: s?.flutterwavePublicKey ?? null, webhookHashSet: Boolean(s?.flutterwaveWebhookHashEnc) },
    korapay: { configured: Boolean(s?.korapaySecretKeyEnc), publicKey: s?.korapayPublicKey ?? null },
  };
}

export interface SaveProviderKeysInput {
  provider: "PAYSTACK" | "FLUTTERWAVE" | "KORAPAY";
  publicKey: string;
  /** Blank means "keep the existing secret key" (the form never round-trips a decrypted secret back to the client). */
  secretKey?: string;
  webhookSecret?: string;
}

export async function saveProviderKeys(hotelId: string, actorId: string, input: SaveProviderKeysInput) {
  const existing = await prisma.hotelPaymentSettings.findUnique({ where: { hotelId } });

  const data: Record<string, string | null> = {};
  if (input.provider === "PAYSTACK") {
    data.paystackPublicKey = input.publicKey || null;
    if (input.secretKey) data.paystackSecretKeyEnc = encryptSecret(input.secretKey);
  } else if (input.provider === "FLUTTERWAVE") {
    data.flutterwavePublicKey = input.publicKey || null;
    if (input.secretKey) data.flutterwaveSecretKeyEnc = encryptSecret(input.secretKey);
    if (input.webhookSecret) data.flutterwaveWebhookHashEnc = encryptSecret(input.webhookSecret);
  } else {
    data.korapayPublicKey = input.publicKey || null;
    if (input.secretKey) data.korapaySecretKeyEnc = encryptSecret(input.secretKey);
  }

  await prisma.hotelPaymentSettings.upsert({
    where: { hotelId },
    create: { hotelId, ...data },
    update: data,
  });

  await recordAuditLog({
    hotelId,
    actorId,
    action: "payment_settings.keys_updated",
    resourceType: "HotelPaymentSettings",
    resourceId: existing?.id ?? hotelId,
    newValue: { provider: input.provider, publicKey: input.publicKey, secretKeyChanged: Boolean(input.secretKey) },
  });
}

export async function setActiveProvider(hotelId: string, actorId: string, provider: PaymentProviderType | null) {
  if (provider) {
    const settings = await prisma.hotelPaymentSettings.findUnique({ where: { hotelId } });
    const hasKeys =
      (provider === "PAYSTACK" && settings?.paystackSecretKeyEnc) ||
      (provider === "FLUTTERWAVE" && settings?.flutterwaveSecretKeyEnc) ||
      (provider === "KORAPAY" && settings?.korapaySecretKeyEnc);
    if (!hasKeys) throw new Error("Add and save this provider's API keys before making it active.");
  }

  await prisma.hotelPaymentSettings.upsert({
    where: { hotelId },
    create: { hotelId, activeProvider: provider },
    update: { activeProvider: provider },
  });

  await recordAuditLog({ hotelId, actorId, action: "payment_settings.active_provider_changed", resourceType: "HotelPaymentSettings", resourceId: hotelId, newValue: { provider } });
}
