import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyKorapayWebhookSignature } from "./korapayClient.js";

const SECRET = "sk_test_kora_abc123";

function sign(dataJson: string, secret: string): string {
  return createHmac("sha256", secret).update(dataJson).digest("hex");
}

describe("verifyKorapayWebhookSignature", () => {
  it("accepts a signature computed over the `data` object only", () => {
    const dataJson = JSON.stringify({ reference: "ref_1", amount: 5000, currency: "NGN", status: "success" });
    expect(verifyKorapayWebhookSignature(dataJson, sign(dataJson, SECRET), SECRET)).toBe(true);
  });

  it("rejects a signature computed over the whole envelope instead of just `data`", () => {
    const data = { reference: "ref_1", amount: 5000, currency: "NGN", status: "success" };
    const dataJson = JSON.stringify(data);
    const wholeBodyJson = JSON.stringify({ event: "charge.success", data });
    // Signing the wrong scope (the whole body) must not verify against the data-only check.
    expect(verifyKorapayWebhookSignature(dataJson, sign(wholeBodyJson, SECRET), SECRET)).toBe(false);
  });

  it("rejects a body signed with the wrong secret", () => {
    const dataJson = JSON.stringify({ reference: "ref_1", amount: 5000 });
    expect(verifyKorapayWebhookSignature(dataJson, sign(dataJson, "wrong-secret"), SECRET)).toBe(false);
  });

  it("rejects a tampered data object signed for a different payload", () => {
    const originalData = JSON.stringify({ reference: "ref_1", amount: 5000 });
    const tamperedData = JSON.stringify({ reference: "ref_1", amount: 500000 });
    expect(verifyKorapayWebhookSignature(tamperedData, sign(originalData, SECRET), SECRET)).toBe(false);
  });
});
