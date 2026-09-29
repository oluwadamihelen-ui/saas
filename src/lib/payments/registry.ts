import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/security/encryption";
import type { PaymentProviderType } from "@/generated/prisma/enums";
import type { PaymentProviderAdapter, ProviderKeys } from "./types";
import { paystackAdapter } from "./paystack";
import { flutterwaveAdapter } from "./flutterwave";
import { korapayAdapter } from "./korapay";

export const PROVIDER_ADAPTERS: Record<PaymentProviderType, PaymentProviderAdapter> = {
  PAYSTACK: paystackAdapter,
  FLUTTERWAVE: flutterwaveAdapter,
  KORAPAY: korapayAdapter,
};

export const PROVIDER_LABELS: Record<PaymentProviderType, string> = {
  PAYSTACK: "Paystack",
  FLUTTERWAVE: "Flutterwave",
  KORAPAY: "Kora Pay",
};

/** Resolves and decrypts a hotel's currently-active provider's keys, or null if none is configured. */
export async function getActiveProviderKeys(hotelId: string): Promise<{ provider: PaymentProviderType; adapter: PaymentProviderAdapter; keys: ProviderKeys } | null> {
  const settings = await prisma.hotelPaymentSettings.findUnique({ where: { hotelId } });
  if (!settings?.activeProvider) return null;
  return resolveProviderKeys(settings, settings.activeProvider);
}

/** Resolves and decrypts a specific provider's stored keys for a hotel, regardless of which is currently active (used by webhooks, which must verify against whichever provider a given Payment used). */
export async function getProviderKeys(hotelId: string, provider: PaymentProviderType): Promise<{ provider: PaymentProviderType; adapter: PaymentProviderAdapter; keys: ProviderKeys } | null> {
  const settings = await prisma.hotelPaymentSettings.findUnique({ where: { hotelId } });
  if (!settings) return null;
  return resolveProviderKeys(settings, provider);
}

function resolveProviderKeys(
  settings: {
    paystackPublicKey: string | null;
    paystackSecretKeyEnc: string | null;
    flutterwavePublicKey: string | null;
    flutterwaveSecretKeyEnc: string | null;
    flutterwaveWebhookHashEnc: string | null;
    korapayPublicKey: string | null;
    korapaySecretKeyEnc: string | null;
  },
  provider: PaymentProviderType
): { provider: PaymentProviderType; adapter: PaymentProviderAdapter; keys: ProviderKeys } | null {
  if (provider === "PAYSTACK") {
    if (!settings.paystackPublicKey || !settings.paystackSecretKeyEnc) return null;
    return { provider, adapter: PROVIDER_ADAPTERS.PAYSTACK, keys: { publicKey: settings.paystackPublicKey, secretKey: decryptSecret(settings.paystackSecretKeyEnc) } };
  }
  if (provider === "FLUTTERWAVE") {
    if (!settings.flutterwavePublicKey || !settings.flutterwaveSecretKeyEnc) return null;
    return {
      provider,
      adapter: PROVIDER_ADAPTERS.FLUTTERWAVE,
      keys: {
        publicKey: settings.flutterwavePublicKey,
        secretKey: decryptSecret(settings.flutterwaveSecretKeyEnc),
        webhookSecret: settings.flutterwaveWebhookHashEnc ? decryptSecret(settings.flutterwaveWebhookHashEnc) : undefined,
      },
    };
  }
  if (!settings.korapayPublicKey || !settings.korapaySecretKeyEnc) return null;
  return { provider, adapter: PROVIDER_ADAPTERS.KORAPAY, keys: { publicKey: settings.korapayPublicKey, secretKey: decryptSecret(settings.korapaySecretKeyEnc) } };
}
