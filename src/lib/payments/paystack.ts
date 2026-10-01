import { createHmac, timingSafeEqual } from "crypto";
import type { PaymentProvider, VerifyResult, VerifyStatus } from "./types";

const API = "https://api.paystack.co";

function key() {
  const k = process.env.PAYMENT_API_KEY;
  if (!k) throw new Error("PAYMENT_API_KEY is not set");
  return k;
}

/** Paystack signs the RAW request body with your secret key (HMAC-SHA512, hex) in `x-paystack-signature`. */
export function verifyPaystackSignature(rawBody: string, signature: string | null | undefined, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim().toLowerCase(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

interface PaystackTx {
  status: string;
  amount: number;
  currency: string;
  authorization?: { authorization_code?: string; reusable?: boolean };
}

export function mapPaystackTx(tx: PaystackTx | undefined): VerifyResult {
  const s = tx?.status;
  const status: VerifyStatus = s === "success" ? "SUCCEEDED" : s === "failed" || s === "abandoned" || s === "reversed" ? "FAILED" : "PENDING";
  return {
    status,
    amount: tx ? tx.amount / 100 : undefined,
    currency: tx?.currency,
    authorizationCode: tx?.authorization?.reusable ? tx.authorization.authorization_code : undefined,
  };
}

/**
 * Paystack adapter (NGN-first, also accepts USD on many accounts).
 * PAYMENT_API_KEY = Paystack secret key. Exercise with Paystack TEST keys before going live.
 */
export const paystackProvider: PaymentProvider = {
  name: "paystack",
  currencies: ["NGN", "USD"],
  async createCheckout(req) {
    const res = await fetch(`${API}/transaction/initialize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: req.email, amount: Math.round(req.amount * 100), currency: req.currency, reference: req.reference, callback_url: req.callbackUrl }),
    });
    const json = (await res.json()) as { status: boolean; data?: { authorization_url: string } };
    if (!res.ok || !json.status || !json.data) throw new Error("Could not start checkout");
    return { url: json.data.authorization_url };
  },
  async verify(reference) {
    const res = await fetch(`${API}/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${key()}` }, cache: "no-store" });
    const json = (await res.json()) as { data?: PaystackTx };
    return mapPaystackTx(json.data);
  },
  async refund(reference, amountMinor) {
    const res = await fetch(`${API}/refund`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ transaction: reference, ...(amountMinor ? { amount: amountMinor } : {}) }),
    });
    const json = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string };
    return res.ok && json.status ? { ok: true } : { ok: false, error: json.message ?? "Refund failed" };
  },
  async chargeRecurring(req) {
    const res = await fetch(`${API}/transaction/charge_authorization`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: req.email, amount: Math.round(req.amount * 100), currency: req.currency, reference: req.reference, authorization_code: req.authorizationCode }),
    });
    const json = (await res.json()) as { status: boolean; data?: PaystackTx };
    if (!res.ok || !json.status) return { status: "FAILED" };
    return mapPaystackTx(json.data);
  },
};
