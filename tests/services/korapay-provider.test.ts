import { describe, it, expect, vi, afterEach } from "vitest";
import crypto from "crypto";
import { KoraPayPaymentProvider } from "@/lib/providers/payment/korapay";

describe("KoraPayPaymentProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a correctly-shaped charge initialization request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: true, data: { reference: "kora_ref_1", checkout_url: "https://checkout.korapay.com/kora_ref_1" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new KoraPayPaymentProvider("sk_test_key");
    const result = await provider.createPayment({
      orderId: "order-1",
      orderNumber: "ORD-1",
      amount: 5000,
      currency: "NGN",
      customerEmail: "customer@example.com",
      customerName: "Jane Doe",
      callbackUrl: "https://app.example.com/checkout/callback",
    });

    expect(result.authorizationUrl).toBe("https://checkout.korapay.com/kora_ref_1");
    expect(result.providerReference).toBe("kora_ref_1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.korapay.com/merchant/api/v1/charges/initialize");
    expect(init.headers.Authorization).toBe("Bearer sk_test_key");
    const body = JSON.parse(init.body);
    expect(body.amount).toBe(5000);
    expect(body.currency).toBe("NGN");
    expect(body.customer).toEqual({ name: "Jane Doe", email: "customer@example.com" });
  });

  it("verifyPayment maps a success status to PAID", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: true, data: { reference: "kora_ref_1", status: "success", amount: 5000, amount_paid: 5000, currency: "NGN" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new KoraPayPaymentProvider("sk_test_key");
    const result = await provider.verifyPayment("kora_ref_1");
    expect(result.status).toBe("PAID");
    expect(result.amount).toBe(5000);
  });

  it("testConnection reports AUTH_FAILED on a 401", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ status: false, message: "Unauthorized" }) });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new KoraPayPaymentProvider("bad-key");
    const result = await provider.testConnection();
    expect(result.state).toBe("AUTH_FAILED");
  });

  it("testConnection reports CONNECTED when a made-up reference 404s (auth succeeded)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ status: false, message: "Charge not found" }) });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new KoraPayPaymentProvider("good-key");
    const result = await provider.testConnection();
    expect(result.state).toBe("CONNECTED");
  });

  it("verifies a webhook signature as an HMAC-SHA256 of the data object", () => {
    const provider = new KoraPayPaymentProvider("whsec_test");
    const payload = { event: "charge.success", data: { reference: "kora_ref_1", status: "success" } };
    const rawBody = JSON.stringify(payload);
    const validSignature = crypto.createHmac("sha256", "whsec_test").update(JSON.stringify(payload.data)).digest("hex");

    expect(provider.verifyWebhookSignature({ rawBody, signatureHeader: validSignature })).toBe(true);
    expect(provider.verifyWebhookSignature({ rawBody, signatureHeader: "wrong" })).toBe(false);
  });

  it("handleWebhook normalizes a charge.success event", () => {
    const provider = new KoraPayPaymentProvider("whsec_test");
    const payload = { event: "charge.success", data: { reference: "kora_ref_1" } };
    const result = provider.handleWebhook(JSON.stringify(payload));
    expect(result.type).toBe("charge.success");
    expect(result.providerReference).toBe("kora_ref_1");
  });
});
