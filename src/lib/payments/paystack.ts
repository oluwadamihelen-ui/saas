import crypto from "crypto";
import type { PaymentProviderAdapter, ProviderKeys, InitializeChargeInput, InitializeChargeResult, VerifyChargeResult } from "./types";
import { safeJson } from "./http";

const BASE_URL = "https://api.paystack.co";

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data?: { authorization_url: string; access_code: string; reference: string };
}

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data?: { status: string; amount: number; currency: string; reference: string };
}

export const paystackAdapter: PaymentProviderAdapter = {
  async initializeCharge(keys: ProviderKeys, input: InitializeChargeInput): Promise<InitializeChargeResult> {
    const res = await fetch(`${BASE_URL}/transaction/initialize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${keys.secretKey}`, "Content-Type": "application/json" },
      // Paystack amounts are in kobo (the smallest unit) -- multiply the major-unit amount by 100.
      body: JSON.stringify({
        email: input.email,
        amount: Math.round(input.amount * 100),
        currency: input.currency,
        reference: input.reference,
        callback_url: input.redirectUrl,
        metadata: input.customerName ? { customer_name: input.customerName } : undefined,
      }),
    });
    const parsed = await safeJson<PaystackInitializeResponse>(res);
    if (!parsed.ok) throw new Error(parsed.error);
    if (!res.ok || !parsed.body.status || !parsed.body.data) throw new Error(parsed.body.message || "Paystack failed to initialize the transaction.");
    return { checkoutUrl: parsed.body.data.authorization_url };
  },

  async verifyCharge(keys: ProviderKeys, reference: string): Promise<VerifyChargeResult> {
    const res = await fetch(`${BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${keys.secretKey}` },
    });
    const parsed = await safeJson<PaystackVerifyResponse>(res);
    if (!parsed.ok) throw new Error(parsed.error);
    if (!res.ok || !parsed.body.data) throw new Error(parsed.body.message || "Paystack failed to verify the transaction.");
    return {
      success: parsed.body.data.status === "success",
      amount: parsed.body.data.amount / 100,
      currency: parsed.body.data.currency,
      status: parsed.body.data.status,
    };
  },

  verifyWebhookSignature(keys: ProviderKeys, rawBody: string, headers: Headers): boolean {
    const signature = headers.get("x-paystack-signature");
    if (!signature) return false;
    const expected = crypto.createHmac("sha512", keys.secretKey).update(rawBody, "utf8").digest("hex");
    if (expected.length !== signature.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  },

  extractReference(payload: unknown): string | null {
    const data = (payload as { data?: { reference?: string } } | null)?.data;
    return data?.reference ?? null;
  },
};
