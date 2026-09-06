import crypto from "crypto";
import { ProviderTestResult } from "../types";
import {
  CancelSubscriptionResult,
  CreateCustomerInput,
  CreateCustomerResult,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  InitializePaymentInput,
  InitializePaymentResult,
  PaymentProvider,
  PaymentProviderCapabilities,
  RefundInput,
  RefundResult,
  VerifyPaymentResult,
  WebhookVerificationInput,
} from "./types";

interface MockTransaction {
  orderId: string;
  amount: number;
  currency: string;
  status: "PAID" | "FAILED" | "PENDING";
  paidAt: string | null;
}

// Simulates provider-side state (transactions, customers, subscriptions) so
// verify/getTransaction calls reflect what was actually initialized instead
// of a hardcoded stub -- this is what makes the amount/currency validation
// in OrderService.markOrderPaid exercise real logic in mock mode too.
const transactions = new Map<string, MockTransaction>();
const customers = new Map<string, { email: string; name: string }>();
const subscriptions = new Map<string, { status: string; currentPeriodStart: string; currentPeriodEnd: string }>();

/**
 * Simulates a hosted-checkout payment provider entirely in-process so the
 * platform is fully testable without real payment credentials. The customer
 * is sent to our own `/checkout/mock-pay` page instead of a third party.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly key = "mock";
  readonly label = "Mock Payments (Demo Mode)";
  readonly capabilities: PaymentProviderCapabilities = {
    supportsSubscriptions: true,
    supportsRefunds: true,
    supportsCustomers: true,
    supportsWebhooks: true,
  };

  async testConnection(): Promise<ProviderTestResult> {
    return { state: "CONNECTED", message: "Mock provider always connects.", checkedAt: new Date().toISOString() };
  }

  async createPayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const providerReference = `mock_${crypto.randomUUID()}`;
    transactions.set(providerReference, {
      orderId: input.orderId,
      amount: input.amount,
      currency: input.currency,
      status: "PENDING",
      paidAt: null,
    });
    const url = new URL(input.callbackUrl.replace("/callback", "/mock-pay"));
    url.searchParams.set("ref", providerReference);
    url.searchParams.set("orderId", input.orderId);
    url.searchParams.set("amount", String(input.amount));
    return { authorizationUrl: url.toString(), providerReference };
  }

  async verifyPayment(providerReference: string): Promise<VerifyPaymentResult> {
    const tx = transactions.get(providerReference);
    // A mock-pay confirmation marks the in-memory transaction PAID before
    // calling the webhook, mirroring how a real provider's own record is
    // authoritative ahead of (or independent of) webhook delivery.
    const isMock = providerReference.startsWith("mock_");
    if (!tx) {
      return { providerReference, status: isMock ? "PENDING" : "FAILED", amount: 0, currency: "USD", paidAt: null, raw: { mock: true } };
    }
    return {
      providerReference,
      status: tx.status,
      amount: tx.amount,
      currency: tx.currency,
      paidAt: tx.paidAt,
      raw: { mock: true, ...tx },
    };
  }

  async getTransaction(providerReference: string): Promise<VerifyPaymentResult> {
    return this.verifyPayment(providerReference);
  }

  async refundPayment(_input: RefundInput): Promise<RefundResult> {
    return { providerRefundReference: `mock_refund_${crypto.randomUUID()}`, status: "PROCESSED" };
  }

  verifyWebhookSignature(input: WebhookVerificationInput): boolean {
    // Mock provider signs with a fixed dev secret so the webhook route path
    // is exercised the same way a real signature check would be.
    const expected = crypto.createHmac("sha256", "mock-webhook-secret").update(input.rawBody).digest("hex");
    return input.signatureHeader === expected;
  }

  handleWebhook(rawBody: string) {
    const payload = JSON.parse(rawBody);
    const reference = payload.reference as string;
    const tx = transactions.get(reference);
    if (tx) {
      tx.status = "PAID";
      tx.paidAt = new Date().toISOString();
    }
    return { type: payload.event ?? "charge.success", providerReference: reference, raw: payload };
  }

  async createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
    const providerCustomerId = `mock_cus_${crypto.randomUUID()}`;
    customers.set(providerCustomerId, { email: input.email, name: input.name });
    return { providerCustomerId };
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    const providerSubscriptionId = `mock_sub_${crypto.randomUUID()}`;
    const now = new Date();
    const end = new Date(now);
    if (input.billingCycle === "YEARLY") end.setFullYear(end.getFullYear() + 1);
    else end.setMonth(end.getMonth() + 1);
    const status = input.trialDays ? "TRIAL" : "ACTIVE";
    subscriptions.set(providerSubscriptionId, {
      status,
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: end.toISOString(),
    });
    return { providerSubscriptionId, status, currentPeriodStart: now.toISOString(), currentPeriodEnd: end.toISOString() };
  }

  async cancelSubscription(providerSubscriptionId: string): Promise<CancelSubscriptionResult> {
    subscriptions.delete(providerSubscriptionId);
    return { status: "CANCELLED", cancelledAt: new Date().toISOString() };
  }

  static signPayload(rawBody: string): string {
    return crypto.createHmac("sha256", "mock-webhook-secret").update(rawBody).digest("hex");
  }
}
