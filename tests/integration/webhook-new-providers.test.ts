import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/webhooks/[provider]/route";

/**
 * KoraPay and NOWPayments ship without any credentials configured in this
 * environment (the user will supply real keys later). The webhook route
 * must fail safely -- a 404 "Unknown provider", never a crash or a silent
 * success -- when KORAPAY_SECRET_KEY / NOWPAYMENTS_API_KEY+IPN_SECRET are
 * unset, exactly like it already does for any other unconfigured adapter.
 */
describe("payment webhook: korapay/nowpayments without credentials configured", () => {
  it("returns 404 for korapay when KORAPAY_SECRET_KEY is unset", async () => {
    expect(process.env.KORAPAY_SECRET_KEY).toBeUndefined();
    const req = new NextRequest("http://localhost/api/webhooks/korapay", {
      method: "POST",
      headers: { "content-type": "application/json", "x-korapay-signature": "irrelevant" },
      body: JSON.stringify({ event: "charge.success", data: { reference: "irrelevant" } }),
    });

    const res = await POST(req, { params: Promise.resolve({ provider: "korapay" }) });
    expect(res.status).toBe(404);
  });

  it("returns 404 for nowpayments when NOWPAYMENTS_API_KEY/IPN_SECRET are unset", async () => {
    expect(process.env.NOWPAYMENTS_API_KEY).toBeUndefined();
    expect(process.env.NOWPAYMENTS_IPN_SECRET).toBeUndefined();
    const req = new NextRequest("http://localhost/api/webhooks/nowpayments", {
      method: "POST",
      headers: { "content-type": "application/json", "x-nowpayments-sig": "irrelevant" },
      body: JSON.stringify({ order_id: "irrelevant", payment_status: "finished" }),
    });

    const res = await POST(req, { params: Promise.resolve({ provider: "nowpayments" }) });
    expect(res.status).toBe(404);
  });
});
