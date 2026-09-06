import crypto from "crypto";
import { ProviderTestResult } from "../types";
import {
  InitializePaymentInput,
  InitializePaymentResult,
  PaymentProvider,
  RefundInput,
  RefundResult,
  VerifyPaymentResult,
  WebhookVerificationInput,
} from "./types";

/**
 * Simulates a hosted-checkout payment provider entirely in-process so the
 * platform is fully testable without real payment credentials. The customer
 * is sent to our own `/checkout/mock-pay` page instead of a third party.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly key = "mock";
  readonly label = "Mock Payments (Demo Mode)";

  async testConnection(): Promise<ProviderTestResult> {
    return { state: "CONNECTED", message: "Mock provider always connects.", checkedAt: new Date().toISOString() };
  }

  async initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const providerReference = `mock_${crypto.randomUUID()}`;
    const url = new URL(input.callbackUrl.replace("/callback", "/mock-pay"));
    url.searchParams.set("ref", providerReference);
    url.searchParams.set("orderId", input.orderId);
    url.searchParams.set("amount", String(input.amount));
    return { authorizationUrl: url.toString(), providerReference };
  }

  async verifyPayment(providerReference: string): Promise<VerifyPaymentResult> {
    // In mock mode, the "mock-pay" page immediately marks the order paid via
    // the same webhook path a real provider would call, so verification here
    // just reflects success for any reference that looks like ours.
    const isMock = providerReference.startsWith("mock_");
    return {
      providerReference,
      status: isMock ? "PAID" : "FAILED",
      amount: 0,
      currency: "USD",
      paidAt: isMock ? new Date().toISOString() : null,
      raw: { mock: true },
    };
  }

  async refund(_input: RefundInput): Promise<RefundResult> {
    return { providerRefundReference: `mock_refund_${crypto.randomUUID()}`, status: "PROCESSED" };
  }

  verifyWebhookSignature(input: WebhookVerificationInput): boolean {
    // Mock provider signs with a fixed dev secret so the webhook route path
    // is exercised the same way a real signature check would be.
    const expected = crypto.createHmac("sha256", "mock-webhook-secret").update(input.rawBody).digest("hex");
    return input.signatureHeader === expected;
  }

  parseWebhookEvent(rawBody: string) {
    const payload = JSON.parse(rawBody);
    return { type: payload.event ?? "charge.success", providerReference: payload.reference, raw: payload };
  }

  static signPayload(rawBody: string): string {
    return crypto.createHmac("sha256", "mock-webhook-secret").update(rawBody).digest("hex");
  }
}
