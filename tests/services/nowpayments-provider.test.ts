import { describe, it, expect, vi, afterEach } from "vitest";
import crypto from "crypto";
import { NowPaymentsPaymentProvider } from "@/lib/providers/payment/nowpayments";

describe("NowPaymentsPaymentProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a hosted invoice and returns its invoice_url", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 123456, order_id: "order_order-1_1700000000000", invoice_url: "https://nowpayments.io/payment/?iid=123456" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new NowPaymentsPaymentProvider("api-key", "ipn-secret");
    const result = await provider.createPayment({
      orderId: "order-1",
      orderNumber: "ORD-1",
      amount: 100,
      currency: "USD",
      customerEmail: "customer@example.com",
      customerName: "Jane Doe",
      callbackUrl: "https://app.example.com/checkout/callback",
    });

    expect(result.authorizationUrl).toBe("https://nowpayments.io/payment/?iid=123456");
    expect(result.providerReference).toMatch(/^order_order-1_\d+$/);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.nowpayments.io/v1/invoice");
    expect(init.headers["x-api-key"]).toBe("api-key");
    const body = JSON.parse(init.body);
    expect(body.price_amount).toBe(100);
    expect(body.price_currency).toBe("USD");
    expect(body.order_id).toBe(result.providerReference);
  });

  it("verifyPayment maps a finished payment_status to PAID", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ order_id: "order_order-1_1", payment_status: "finished", price_amount: 100, price_currency: "USD", actually_paid: 100 }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new NowPaymentsPaymentProvider("api-key", "ipn-secret");
    const result = await provider.verifyPayment("order_order-1_1");
    expect(result.status).toBe("PAID");
    expect(result.amount).toBe(100);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("orderId=order_order-1_1");
  });

  it("verifyPayment returns PENDING when no matching record is found yet", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new NowPaymentsPaymentProvider("api-key", "ipn-secret");
    const result = await provider.verifyPayment("order_order-1_1");
    expect(result.status).toBe("PENDING");
  });

  it("refundPayment always throws -- crypto payments are irreversible", async () => {
    const provider = new NowPaymentsPaymentProvider("api-key", "ipn-secret");
    await expect(provider.refundPayment({ providerReference: "x", amount: 1, reason: "test" })).rejects.toThrow();
  });

  it("verifies an IPN signature as an HMAC-SHA512 of the recursively key-sorted body", () => {
    const provider = new NowPaymentsPaymentProvider("api-key", "ipn-secret-value");
    const payload = { order_id: "order_order-1_1", payment_status: "finished", price_amount: 100 };
    const rawBody = JSON.stringify(payload);
    const sortedKeys = Object.keys(payload).sort();
    const sorted = sortedKeys.reduce((acc: Record<string, unknown>, key) => {
      acc[key] = (payload as Record<string, unknown>)[key];
      return acc;
    }, {});
    const validSignature = crypto.createHmac("sha512", "ipn-secret-value").update(JSON.stringify(sorted)).digest("hex");

    expect(provider.verifyWebhookSignature({ rawBody, signatureHeader: validSignature })).toBe(true);
    expect(provider.verifyWebhookSignature({ rawBody, signatureHeader: "wrong" })).toBe(false);
  });

  it("handleWebhook normalizes a finished payment to charge.success", () => {
    const provider = new NowPaymentsPaymentProvider("api-key", "ipn-secret");
    const payload = { order_id: "order_order-1_1", payment_status: "finished" };
    const result = provider.handleWebhook(JSON.stringify(payload));
    expect(result.type).toBe("charge.success");
    expect(result.providerReference).toBe("order_order-1_1");
  });

  it("handleWebhook normalizes a non-finished status to a distinct, ignorable type", () => {
    const provider = new NowPaymentsPaymentProvider("api-key", "ipn-secret");
    const payload = { order_id: "order_order-1_1", payment_status: "waiting" };
    const result = provider.handleWebhook(JSON.stringify(payload));
    expect(result.type).toBe("payment.waiting");
  });

  it("testConnection reports AUTH_FAILED on a 401", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: "Invalid API key" }) });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new NowPaymentsPaymentProvider("bad-key", "ipn-secret");
    const result = await provider.testConnection();
    expect(result.state).toBe("AUTH_FAILED");
  });
});
