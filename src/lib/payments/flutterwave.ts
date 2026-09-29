import crypto from "crypto";
import type { PaymentProviderAdapter, ProviderKeys, InitializeChargeInput, InitializeChargeResult, VerifyChargeResult } from "./types";
import { safeJson } from "./http";

const BASE_URL = "https://api.flutterwave.com/v3";

interface FlutterwaveInitializeResponse {
  status: string;
  message: string;
  data?: { link: string };
}

interface FlutterwaveVerifyResponse {
  status: string;
  message: string;
  data?: { status: string; amount: number; currency: string; tx_ref: string };
}

export const flutterwaveAdapter: PaymentProviderAdapter = {
  async initializeCharge(keys: ProviderKeys, input: InitializeChargeInput): Promise<InitializeChargeResult> {
    const res = await fetch(`${BASE_URL}/payments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${keys.secretKey}`, "Content-Type": "application/json" },
      // Flutterwave takes the amount in the currency's normal major unit -- no *100 conversion.
      body: JSON.stringify({
        tx_ref: input.reference,
        amount: input.amount,
        currency: input.currency,
        redirect_url: input.redirectUrl,
        customer: { email: input.email, name: input.customerName },
        customizations: { title: "Otelum" },
      }),
    });
    const parsed = await safeJson<FlutterwaveInitializeResponse>(res);
    if (!parsed.ok) throw new Error(parsed.error);
    if (!res.ok || parsed.body.status !== "success" || !parsed.body.data) throw new Error(parsed.body.message || "Flutterwave failed to initialize the transaction.");
    return { checkoutUrl: parsed.body.data.link };
  },

  async verifyCharge(keys: ProviderKeys, reference: string): Promise<VerifyChargeResult> {
    const res = await fetch(`${BASE_URL}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${keys.secretKey}` },
    });
    const parsed = await safeJson<FlutterwaveVerifyResponse>(res);
    if (!parsed.ok) throw new Error(parsed.error);
    if (!res.ok || !parsed.body.data) throw new Error(parsed.body.message || "Flutterwave failed to verify the transaction.");
    return {
      success: parsed.body.data.status === "successful",
      amount: parsed.body.data.amount,
      currency: parsed.body.data.currency,
      status: parsed.body.data.status,
    };
  },

  verifyWebhookSignature(keys: ProviderKeys, _rawBody: string, headers: Headers): boolean {
    // Flutterwave doesn't sign the body -- it echoes back a merchant-configured shared secret
    // ("secret hash") verbatim in this header. A plain, constant-time string compare is correct here.
    const received = headers.get("verif-hash");
    if (!received || !keys.webhookSecret) return false;
    const a = Buffer.from(received);
    const b = Buffer.from(keys.webhookSecret);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  },

  extractReference(payload: unknown): string | null {
    const data = (payload as { data?: { tx_ref?: string } } | null)?.data;
    return data?.tx_ref ?? null;
  },
};
