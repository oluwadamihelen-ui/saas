import type { PaymentProvider } from "./types";

/** Development provider: sends the user to an internal page where they "pay" with one click. */
export const mockProvider: PaymentProvider = {
  name: "mock",
  currencies: ["USD", "NGN"],
  async createCheckout(req) {
    return { url: `${req.callbackUrl.replace(/\/billing\/callback.*/, "")}/billing/mock?reference=${encodeURIComponent(req.reference)}` };
  },
  async verify() {
    // The mock page marks the payment itself; the callback just reads our DB state.
    return { status: "PENDING" };
  },
};
