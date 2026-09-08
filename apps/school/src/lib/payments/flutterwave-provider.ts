import "server-only";
import { safeJson, gatewayFetch } from "./http";
import type { PaymentProvider } from "./types";

const BASE_URL = "https://api.flutterwave.com/v3";

/// Flutterwave's API takes amount as a decimal in the currency's MAJOR
/// unit (e.g. "5000.00" Naira, not 500000 kobo) — the one gateway of the
/// three that doesn't match amountMinor's convention directly, so every
/// amount crossing this boundary is explicitly /100 or *100.
export const flutterwaveProvider: PaymentProvider = {
  name: "FLUTTERWAVE",

  async initialize({ amountMinor, currency, reference, callbackUrl, payerEmail }, credentials) {
    if (!credentials) throw new Error("Flutterwave requires the school's own API keys.");

    const res = await gatewayFetch(
      `${BASE_URL}/payments`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${credentials.secretKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          tx_ref: reference,
          amount: (amountMinor / 100).toFixed(2),
          currency,
          redirect_url: callbackUrl,
          customer: { email: payerEmail },
        }),
      },
      "Flutterwave"
    );
    const body = await safeJson(res);
    const data = body.data as { link?: string } | undefined;
    if (!res.ok || body.status !== "success" || !data?.link) {
      throw new Error(typeof body.message === "string" ? body.message : "Flutterwave could not start this payment. Please try again shortly.");
    }
    return { authorizationUrl: data.link };
  },

  async verify(reference, credentials) {
    if (!credentials) throw new Error("Flutterwave requires the school's own API keys.");

    const res = await gatewayFetch(
      `${BASE_URL}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${credentials.secretKey}` } },
      "Flutterwave"
    );
    const body = await safeJson(res);
    const data = body.data as { status?: string; amount?: number } | undefined;
    if (!res.ok || body.status !== "success" || !data) {
      return { status: "failed", amountMinor: 0 };
    }
    const status = data.status === "successful" ? "success" : data.status === "pending" ? "pending" : "failed";
    return { status, amountMinor: Math.round(Number(data.amount ?? 0) * 100) };
  },
};
