import { describe, expect, it } from "vitest";
import { MockPaymentProvider } from "@/lib/providers/payment/mock";

describe("MockPaymentProvider", () => {
  it("builds a checkout URL pointing at the mock payment page", async () => {
    const provider = new MockPaymentProvider();
    const result = await provider.initializePayment({
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
});
