import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyPaystackWebhookSignature } from "./paystackClient.js";

const SECRET = "sk_test_abc123";

function sign(body: string, secret: string): string {
  return createHmac("sha512", secret).update(body).digest("hex");
}

describe("verifyPaystackWebhookSignature", () => {
  it("accepts a correctly signed body", () => {
    const body = JSON.stringify({ event: "subscription.create", data: { subscription_code: "SUB_1" } });
    expect(verifyPaystackWebhookSignature(body, sign(body, SECRET), SECRET)).toBe(true);
  });

  it("rejects a body signed with the wrong secret", () => {
    const body = JSON.stringify({ event: "subscription.create", data: { subscription_code: "SUB_1" } });
    expect(verifyPaystackWebhookSignature(body, sign(body, "wrong-secret"), SECRET)).toBe(false);
  });

  it("rejects a tampered body signed for a different payload", () => {
    const originalBody = JSON.stringify({ event: "subscription.create", data: { subscription_code: "SUB_1" } });
    const tamperedBody = JSON.stringify({ event: "subscription.create", data: { subscription_code: "SUB_2" } });
    expect(verifyPaystackWebhookSignature(tamperedBody, sign(originalBody, SECRET), SECRET)).toBe(false);
  });

  it("rejects a malformed (non-hex) signature without throwing", () => {
    const body = JSON.stringify({ event: "subscription.create" });
    expect(verifyPaystackWebhookSignature(body, "not-a-valid-hex-signature", SECRET)).toBe(false);
  });
});
