import type { PaymentProvider } from "./types";
import { mockProvider } from "./mock";
import { paystackProvider } from "./paystack";

const registry: Record<string, PaymentProvider> = {
  mock: mockProvider,
  paystack: paystackProvider,
  // Add flutterwave / stripe / etc. here — implement PaymentProvider, nothing else changes.
};

/** Look a provider up by the name stored on an order (it may differ from today's PAYMENT_PROVIDER). */
export function getProviderByName(name: string): PaymentProvider {
  const p = registry[name.toLowerCase()];
  if (!p) throw new Error(`Unknown payment provider "${name}"`);
  return p;
}

export function getPaymentProvider(): PaymentProvider {
  const name = (process.env.PAYMENT_PROVIDER ?? "mock").toLowerCase();
  const p = registry[name];
  if (!p) throw new Error(`Unknown PAYMENT_PROVIDER "${name}"`);
  return p;
}
export * from "./types";
