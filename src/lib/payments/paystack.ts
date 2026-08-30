import "server-only";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

/**
 * Resolves the Paystack secret key to use for a business: the merchant's
 * own connected key first, falling back to a platform-level key from env
 * (useful for the demo business or a platform-managed pooled account).
 * Returns null when neither is configured — callers must handle that by
 * telling the merchant to connect Paystack rather than pretending to charge.
 */
export async function getPaystackSecretForBusiness(businessId: string): Promise<string | null> {
  const settings = await prisma.paymentSettings.findUnique({ where: { businessId } });
  if (settings?.paystackSecretKeyEncrypted) {
    const decrypted = decryptSecret(settings.paystackSecretKeyEncrypted);
    if (decrypted) return decrypted;
  }
  return process.env.PAYSTACK_SECRET_KEY || null;
}

export async function getPaystackPublicKeyForBusiness(businessId: string): Promise<string | null> {
  const settings = await prisma.paymentSettings.findUnique({ where: { businessId } });
  if (settings?.paystackPublicKey) return settings.paystackPublicKey;
  return process.env.PAYSTACK_PUBLIC_KEY || null;
}

export type InitializeTransactionInput = {
  secretKey: string;
  email: string;
  amountKobo: number;
  reference: string;
  currency?: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
};

export async function initializeTransaction(input: InitializeTransactionInput) {
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo,
      reference: input.reference,
      currency: input.currency ?? "NGN",
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.status) {
    throw new Error(data.message || "Failed to initialize Paystack transaction");
  }
  return data.data as { authorization_url: string; access_code: string; reference: string };
}

export async function verifyTransaction(reference: string, secretKey: string) {
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const data = await res.json();
  if (!res.ok || !data.status) {
    throw new Error(data.message || "Failed to verify Paystack transaction");
  }
  return data.data as {
    id: number;
    status: string; // "success" | "failed" | "abandoned"
    reference: string;
    amount: number;
    currency: string;
    customer: { email: string };
    metadata?: Record<string, unknown>;
  };
}

/** Verifies the `x-paystack-signature` header per Paystack's HMAC-SHA512 scheme. */
export function verifyWebhookSignature(rawBody: string, signature: string | null, secretKey: string): boolean {
  if (!signature) return false;
  const hash = crypto.createHmac("sha512", secretKey).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}
