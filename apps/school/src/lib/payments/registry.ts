import "server-only";
import { mockPaymentProvider } from "./mock-provider";
import type { PaymentProvider } from "./types";

const PROVIDERS: Record<string, PaymentProvider> = {
  mock: mockPaymentProvider,
  // Add a real adapter (Paystack, Flutterwave, ...) here and select it via
  // PAYMENT_PROVIDER — nothing calling getPaymentProvider() needs to change.
};

export function getPaymentProvider(): PaymentProvider {
  const key = process.env.PAYMENT_PROVIDER || "mock";
  return PROVIDERS[key] ?? mockPaymentProvider;
}
