import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifyWebhookSignature } from "@/lib/payments/paystack";

describe("Paystack webhook signature verification", () => {
  const secret = "sk_test_something_secret";
  const body = JSON.stringify({ event: "charge.success", data: { reference: "REF-123", status: "success" } });

  it("accepts a correctly signed payload", () => {
    const signature = crypto.createHmac("sha512", secret).update(body).digest("hex");
    expect(verifyWebhookSignature(body, signature, secret)).toBe(true);
  });

  it("rejects a tampered payload", () => {
    const signature = crypto.createHmac("sha512", secret).update(body).digest("hex");
    const tampered = body.replace("REF-123", "REF-999");
    expect(verifyWebhookSignature(tampered, signature, secret)).toBe(false);
  });

  it("rejects a signature made with the wrong secret", () => {
    const signature = crypto.createHmac("sha512", "wrong-secret").update(body).digest("hex");
    expect(verifyWebhookSignature(body, signature, secret)).toBe(false);
  });

  it("rejects a missing signature", () => {
    expect(verifyWebhookSignature(body, null, secret)).toBe(false);
  });
});
