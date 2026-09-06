import { describe, expect, it } from "vitest";
import { MockPaymentProvider } from "@/lib/providers/payment/mock";

describe("MockPaymentProvider", () => {
  it("declares its capabilities", () => {
    const provider = new MockPaymentProvider();
    expect(provider.capabilities).toEqual({
      supportsSubscriptions: true,
      supportsRefunds: true,
      supportsCustomers: true,
      supportsWebhooks: true,
    });
  });

  it("builds a checkout URL pointing at the mock payment page", async () => {
    const provider = new MockPaymentProvider();
    const result = await provider.createPayment({
      orderId: "order-1",
      orderNumber: "ORD-2601-000001",
      amount: 100,
      currency: "USD",
      customerEmail: "buyer@example.com",
      customerName: "Buyer",
      callbackUrl: "http://localhost:3000/checkout/callback?orderId=order-1",
    });

    expect(result.authorizationUrl).toContain("/checkout/mock-pay");
    expect(result.authorizationUrl).toContain("orderId=order-1");
    expect(result.providerReference).toMatch(/^mock_/);
  });

  it("reports PENDING until the webhook confirms payment, then PAID with the original amount", async () => {
    const provider = new MockPaymentProvider();
    const { providerReference } = await provider.createPayment({
      orderId: "order-2",
      orderNumber: "ORD-2601-000002",
      amount: 249.99,
      currency: "USD",
      customerEmail: "buyer@example.com",
      customerName: "Buyer",
      callbackUrl: "http://localhost:3000/checkout/callback?orderId=order-2",
    });

    const beforeWebhook = await provider.verifyPayment(providerReference);
    expect(beforeWebhook.status).toBe("PENDING");

    const payload = JSON.stringify({ event: "charge.success", reference: providerReference });
    provider.handleWebhook(payload);

    const afterWebhook = await provider.getTransaction(providerReference);
    expect(afterWebhook.status).toBe("PAID");
    expect(afterWebhook.amount).toBe(249.99);
    expect(afterWebhook.currency).toBe("USD");
  });

  it("rejects a webhook body whose signature does not match", () => {
    const provider = new MockPaymentProvider();
    const body = JSON.stringify({ event: "charge.success", reference: "mock_abc" });

    expect(provider.verifyWebhookSignature({ rawBody: body, signatureHeader: "not-the-real-signature" })).toBe(false);
    expect(
      provider.verifyWebhookSignature({ rawBody: body, signatureHeader: MockPaymentProvider.signPayload(body) })
    ).toBe(true);
  });

  it("never trusts an unsigned webhook, even with a well-formed payload", () => {
    const provider = new MockPaymentProvider();
    const body = JSON.stringify({ event: "charge.success", reference: "mock_abc" });
    expect(provider.verifyWebhookSignature({ rawBody: body, signatureHeader: null })).toBe(false);
  });

  it("supports the customer + subscription lifecycle", async () => {
    const provider = new MockPaymentProvider();
    const customer = await provider.createCustomer!({ email: "sub@example.com", name: "Sub Scriber" });
    expect(customer.providerCustomerId).toMatch(/^mock_cus_/);

    const subscription = await provider.createSubscription!({
      providerCustomerId: customer.providerCustomerId,
      planReference: "hosting-starter",
      amount: 12,
      currency: "USD",
      billingCycle: "MONTHLY",
    });
    expect(subscription.status).toBe("ACTIVE");
    expect(new Date(subscription.currentPeriodEnd).getTime()).toBeGreaterThan(new Date(subscription.currentPeriodStart).getTime());

    const cancelled = await provider.cancelSubscription!(subscription.providerSubscriptionId);
    expect(cancelled.status).toBe("CANCELLED");
  });
});
