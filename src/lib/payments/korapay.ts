import crypto from "crypto";
import type { PaymentProviderAdapter, ProviderKeys, InitializeChargeInput, InitializeChargeResult, VerifyChargeResult } from "./types";
import { safeJson } from "./http";

const BASE_URL = "https://api.korapay.com/merchant/api/v1";

// UNVERIFIED: Kora Pay's public docs were unreachable from this environment
// (network policy) while writing this integration, and available sources
// disagreed on whether `amount` is major units (e.g. 5000 = NGN 5,000, like
// Flutterwave) or minor/kobo units (5000 = NGN 50). This is set to major
// units -- the more common convention among Nigerian gateways and Kora's
// own dashboard examples. TEST THIS WITH A SMALL REAL SANDBOX CHARGE
// (e.g. NGN 100) BEFORE RELYING ON IT: if the amount actually charged is
// 100x what you expect (either direction), flip AMOUNT_IS_MAJOR_UNIT below.
const AMOUNT_IS_MAJOR_UNIT = true;
function toKoraAmount(majorAmount: number): number {
  return AMOUNT_IS_MAJOR_UNIT ? majorAmount : Math.round(majorAmount * 100);
}
function fromKoraAmount(koraAmount: number): number {
  return AMOUNT_IS_MAJOR_UNIT ? koraAmount : koraAmount / 100;
}

interface KorapayInitializeResponse {
  status: boolean;
  message: string;
  data?: { reference: string; checkout_url: string };
}

interface KorapayVerifyResponse {
  status: boolean;
  message: string;
  data?: { status: string; amount: number; currency: string; reference: string };
}

export const korapayAdapter: PaymentProviderAdapter = {
  async initializeCharge(keys: ProviderKeys, input: InitializeChargeInput): Promise<InitializeChargeResult> {
    const res = await fetch(`${BASE_URL}/charges/initialize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${keys.secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: toKoraAmount(input.amount),
        currency: input.currency,
        reference: input.reference,
        redirect_url: input.redirectUrl,
        narration: "Otelum hotel payment",
        customer: { email: input.email, name: input.customerName },
      }),
    });
    const parsed = await safeJson<KorapayInitializeResponse>(res);
    if (!parsed.ok) throw new Error(parsed.error);
    if (!res.ok || !parsed.body.status || !parsed.body.data) throw new Error(parsed.body.message || "Kora Pay failed to initialize the transaction.");
    return { checkoutUrl: parsed.body.data.checkout_url };
  },

  async verifyCharge(keys: ProviderKeys, reference: string): Promise<VerifyChargeResult> {
    const res = await fetch(`${BASE_URL}/charges/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${keys.secretKey}` },
    });
    const parsed = await safeJson<KorapayVerifyResponse>(res);
    if (!parsed.ok) throw new Error(parsed.error);
    if (!res.ok || !parsed.body.data) throw new Error(parsed.body.message || "Kora Pay failed to verify the transaction.");
    return {
      success: parsed.body.data.status === "success",
      amount: fromKoraAmount(parsed.body.data.amount),
      currency: parsed.body.data.currency,
      status: parsed.body.data.status,
    };
  },

  verifyWebhookSignature(keys: ProviderKeys, rawBody: string, headers: Headers): boolean {
    const signature = headers.get("x-korapay-signature");
    if (!signature) return false;
    // Kora signs only the `data` object of the payload, not the full body.
    let dataJson: string;
    try {
      const parsed = JSON.parse(rawBody) as { data?: unknown };
      dataJson = JSON.stringify(parsed.data ?? {});
    } catch {
      return false;
    }
    const expected = crypto.createHmac("sha256", keys.secretKey).update(dataJson, "utf8").digest("hex");
    if (expected.length !== signature.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  },

  extractReference(payload: unknown): string | null {
    const data = (payload as { data?: { reference?: string } } | null)?.data;
    return data?.reference ?? null;
  },
};
