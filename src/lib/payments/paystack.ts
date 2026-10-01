import type { PaymentProvider, VerifyStatus } from "./types";

const API = "https://api.paystack.co";

/**
 * Paystack adapter (NGN-first, also accepts USD on many accounts).
 * Needs PAYMENT_API_KEY = Paystack secret key. Not exercised in tests — verify
 * with Paystack's test keys before going live.
 */
export const paystackProvider: PaymentProvider = {
  name: "paystack",
  currencies: ["NGN", "USD"],
  async createCheckout(req) {
    const key = process.env.PAYMENT_API_KEY;
    if (!key) throw new Error("PAYMENT_API_KEY is not set");
    const res = await fetch(`${API}/transaction/initialize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: req.email,
        amount: Math.round(req.amount * 100), // minor units (kobo / cents)
        currency: req.currency,
        reference: req.reference,
        callback_url: req.callbackUrl,
      }),
    });
    const json = (await res.json()) as { status: boolean; data?: { authorization_url: string } };
    if (!res.ok || !json.status || !json.data) throw new Error("Could not start checkout");
    return { url: json.data.authorization_url };
  },
  async verify(reference) {
    const key = process.env.PAYMENT_API_KEY;
    if (!key) throw new Error("PAYMENT_API_KEY is not set");
    const res = await fetch(`${API}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    const json = (await res.json()) as { data?: { status: string; amount: number; currency: string } };
    const s = json.data?.status;
    const status: VerifyStatus = s === "success" ? "SUCCEEDED" : s === "failed" || s === "abandoned" ? "FAILED" : "PENDING";
    return { status, amount: json.data ? json.data.amount / 100 : undefined, currency: json.data?.currency };
  },
};
