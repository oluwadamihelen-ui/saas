import type { PaymentProvider } from "./types";

/** Development provider: internal "Pay" page, and renewals that always succeed (set MOCK_RENEWAL_FAIL=1 to simulate a decline). */
export const mockProvider: PaymentProvider = {
  name: "mock",
  currencies: ["USD", "NGN"],
  async createCheckout(req) {
    return { url: `${new URL(req.callbackUrl).origin}/billing/mock?reference=${encodeURIComponent(req.reference)}` };
  },
  async verify() {
    // The mock page marks the payment itself; the callback just reads our DB state.
    return { status: "PENDING" };
  },
  async refund() {
    return process.env.MOCK_REFUND_FAIL === "1" ? { ok: false, error: "Mock refund declined" } : { ok: true };
  },
  async chargeRecurring(req) {
    if (process.env.MOCK_RENEWAL_FAIL === "1") return { status: "FAILED" };
    return { status: "SUCCEEDED", amount: req.amount, currency: req.currency, authorizationCode: req.authorizationCode };
  },
};
