import "server-only";
import { safeJson, gatewayFetch } from "./http";
import type { PaymentProvider } from "./types";

const BASE_URL = "https://api.paystack.co";

/// Paystack's API already speaks in the smallest currency unit (kobo,
/// pesewas, cents, ...) — the same convention amountMinor already uses
/// throughout this app, so no conversion is needed in either direction.
export const paystackProvider: PaymentProvider = {
  name: "PAYSTACK",

  async initialize({ amountMinor, currency, reference, callbackUrl, payerEmail }, credentials) {
    if (!credentials) throw new Error("Paystack requires the school's own API keys.");

    const res = await gatewayFetch(
      `${BASE_URL}/transaction/initialize`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${credentials.secretKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: payerEmail, amount: amountMinor, currency, reference, callback_url: callbackUrl }),
      },
      "Paystack"
    );
    const body = await safeJson(res);
    const data = body.data as { authorization_url?: string } | undefined;
    if (!res.ok || !body.status || !data?.authorization_url) {
      throw new Error(typeof body.message === "string" ? body.message : "Paystack could not start this payment. Please try again shortly.");
    }
    return { authorizationUrl: data.authorization_url };
  },

  async verify(reference, credentials) {
    if (!credentials) throw new Error("Paystack requires the school's own API keys.");

    const res = await gatewayFetch(
      `${BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${credentials.secretKey}` } },
      "Paystack"
    );
    const body = await safeJson(res);
    const data = body.data as { status?: string; amount?: number } | undefined;
    if (!res.ok || !body.status || !data) {
      return { status: "failed", amountMinor: 0 };
    }
    const status = data.status === "success" ? "success" : data.status === "abandoned" ? "pending" : "failed";
    return { status, amountMinor: data.amount ?? 0 };
  },
};
