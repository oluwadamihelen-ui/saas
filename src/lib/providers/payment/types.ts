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

export interface PaymentProvider extends ProviderAdapterBase {
  initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult>;
  verifyPayment(providerReference: string): Promise<VerifyPaymentResult>;
  refund(input: RefundInput): Promise<RefundResult>;
  /** Verifies an inbound webhook's signature before its payload is trusted. */
  verifyWebhookSignature(input: WebhookVerificationInput): boolean;
  /** Parses a verified webhook body into a normalized event. */
  parseWebhookEvent(rawBody: string): { type: string; providerReference: string; raw: unknown };
}
