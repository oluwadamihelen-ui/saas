import type { PaymentProvider } from "./types";
import { mockProvider } from "./mock";
import { paystackProvider } from "./paystack";

const registry: Record<string, PaymentProvider> = {
  mock: mockProvider,
  paystack: paystackProvider,
  // Add flutterwave / stripe / etc. here — implement PaymentProvider, nothing else changes.
};

export function getPaymentProvider(): PaymentProvider {
  const name = (process.env.PAYMENT_PROVIDER ?? "mock").toLowerCase();
  const p = registry[name];
  if (!p) throw new Error(`Unknown PAYMENT_PROVIDER "${name}"`);
  return p;
}
export * from "./types";
