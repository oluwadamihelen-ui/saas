/**
 * Payment abstraction. Every processor (Paystack, Flutterwave, Stripe, ...)
 * implements this interface; the rest of the app only talks to `getPaymentProvider()`.
 */
export interface CheckoutRequest {
  reference: string;
  /** Major units (e.g. 5 = $5.00, 7500 = ₦7,500). */
  amount: number;
  currency: "USD" | "NGN" | string;
  email: string;
  callbackUrl: string;
}
export interface CheckoutSession {
  url: string;
}
export type VerifyStatus = "SUCCEEDED" | "FAILED" | "PENDING";

export interface VerifyResult {
  status: VerifyStatus;
  amount?: number;
  currency?: string;
  /** Reusable card token for renewals, when the processor returns one. */
  authorizationCode?: string;
}

export interface RecurringChargeRequest {
  reference: string;
  amount: number;
  currency: string;
  email: string;
  authorizationCode: string;
}

export interface PaymentProvider {
  readonly name: string;
  /** Currencies this processor can charge. */
  readonly currencies: string[];
  createCheckout(req: CheckoutRequest): Promise<CheckoutSession>;
  /** Ask the processor (server-to-server) whether a reference was paid. Never trust the browser. */
  verify(reference: string): Promise<VerifyResult>;
  /** Charge a saved authorization without the customer present (renewals). */
  chargeRecurring?(req: RecurringChargeRequest): Promise<VerifyResult>;
}
