import "server-only";
import { safeJson, gatewayFetch } from "./http";
import type { PaymentProvider } from "./types";

const BASE_URL = "https://api.korapay.com/merchant/api/v1";

/// Korapay, like Flutterwave, takes amount in the currency's MAJOR unit
/// (a number, e.g. 5000 Naira) rather than kobo — converted at the
/// boundary the same way.
export const korapayProvider: PaymentProvider = {
  name: "KORAPAY",

  async initialize({ amountMinor, currency, reference, callbackUrl, payerEmail }, credentials) {
    if (!credentials) throw new Error("Korapay requires the school's own API keys.");

    const res = await gatewayFetch(
      `${BASE_URL}/charges/initialize`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${credentials.secretKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountMinor / 100,
          currency,
          reference,
          redirect_url: callbackUrl,
          customer: { email: payerEmail },
        }),
      },
      "Korapay"
    );
    const body = await safeJson(res);
    const data = body.data as { checkout_url?: string } | undefined;
    if (!res.ok || !body.status || !data?.checkout_url) {
      throw new Error(typeof body.message === "string" ? body.message : "Korapay could not start this payment. Please try again shortly.");
    }
    return { authorizationUrl: data.checkout_url };
  },

  async verify(reference, credentials) {
    if (!credentials) throw new Error("Korapay requires the school's own API keys.");

    const res = await gatewayFetch(
      `${BASE_URL}/charges/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${credentials.secretKey}` } },
      "Korapay"
    );
    const body = await safeJson(res);
    const data = body.data as { status?: string; amount?: number } | undefined;
    if (!res.ok || !body.status || !data) {
      return { status: "failed", amountMinor: 0 };
    }
    const status = data.status === "success" ? "success" : data.status === "processing" ? "pending" : "failed";
    return { status, amountMinor: Math.round(Number(data.amount ?? 0) * 100) };
  },
};
