import { ProviderAdapterBase } from "../types";

export interface InitializePaymentInput {
  orderId: string;
  orderNumber: string;
  amount: number; // in major currency units, e.g. dollars
  currency: string;
  customerEmail: string;
  customerName: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}

export interface InitializePaymentResult {
  /** URL to redirect the customer to (hosted checkout) or null for client-side flows. */
  authorizationUrl: string | null;
  providerReference: string;
}

export interface VerifyPaymentResult {
  providerReference: string;
  status: "PAID" | "FAILED" | "PENDING";
  amount: number;
  currency: string;
  paidAt: string | null;
  raw: unknown;
}

export interface RefundInput {
  providerReference: string;
  amount: number;
  reason: string;
}

export interface RefundResult {
  providerRefundReference: string;
  status: "PROCESSED" | "PENDING" | "FAILED";
}

export interface WebhookVerificationInput {
  rawBody: string;
  signatureHeader: string | null;
}

export interface CreateCustomerInput {
  email: string;
  name: string;
  metadata?: Record<string, unknown>;
}

export interface CreateCustomerResult {
  providerCustomerId: string;
}

export interface CreateSubscriptionInput {
  providerCustomerId: string;
  /** Provider-side plan/price identifier, or a description for providers without pre-defined plans. */
  planReference: string;
  amount: number;
  currency: string;
  billingCycle: "MONTHLY" | "YEARLY";
  trialDays?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateSubscriptionResult {
  providerSubscriptionId: string;
  status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

export interface CancelSubscriptionResult {
  status: "CANCELLED";
  cancelledAt: string;
}

/**
 * Not every payment provider supports every capability (e.g. a simple
 * checkout-only provider may not support recurring subscriptions or a
 * customer object). Declared explicitly so calling code can check before
 * calling an optional method instead of discovering a missing feature at
 * runtime via a thrown error.
 */
export interface PaymentProviderCapabilities {
  supportsSubscriptions: boolean;
  supportsRefunds: boolean;
  supportsCustomers: boolean;
  supportsWebhooks: boolean;
}

export interface PaymentProvider extends ProviderAdapterBase {
  readonly capabilities: PaymentProviderCapabilities;

  createPayment(input: InitializePaymentInput): Promise<InitializePaymentResult>;
  verifyPayment(providerReference: string): Promise<VerifyPaymentResult>;
  /** Alias of verifyPayment kept distinct for callers that just want transaction lookup, not a re-verify side effect. */
  getTransaction(providerReference: string): Promise<VerifyPaymentResult>;
  refundPayment(input: RefundInput): Promise<RefundResult>;

  /** Verifies an inbound webhook's signature before its payload is trusted. */
  verifyWebhookSignature(input: WebhookVerificationInput): boolean;
  /** Parses a verified webhook body into a normalized event. */
  handleWebhook(rawBody: string): { type: string; providerReference: string; raw: unknown };

  // Optional -- only present when capabilities.supportsCustomers / supportsSubscriptions are true.
  createCustomer?(input: CreateCustomerInput): Promise<CreateCustomerResult>;
  createSubscription?(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult>;
  cancelSubscription?(providerSubscriptionId: string): Promise<CancelSubscriptionResult>;
}
