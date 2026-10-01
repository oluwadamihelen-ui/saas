import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { mapPaystackTx, verifyPaystackSignature } from "@/lib/payments/paystack";
import { isRenewalDue, GRACE_MS, RENEW_AHEAD_MS, RETRY_EVERY_MS } from "@/lib/renewals";
import { cronAuthorized } from "@/lib/cron-auth";

const sign = (body: string, secret: string) => createHmac("sha512", secret).update(body).digest("hex");

describe("paystack signature", () => {
  const body = JSON.stringify({ event: "charge.success", data: { reference: "r1" } });
  it("accepts a correct HMAC-SHA512 over the raw body", () => {
    expect(verifyPaystackSignature(body, sign(body, "sk_test"), "sk_test")).toBe(true);
  });
  it("rejects wrong secret, tampered body, missing/short signature, empty secret", () => {
    expect(verifyPaystackSignature(body, sign(body, "other"), "sk_test")).toBe(false);
    expect(verifyPaystackSignature(body + " ", sign(body, "sk_test"), "sk_test")).toBe(false);
    expect(verifyPaystackSignature(body, null, "sk_test")).toBe(false);
    expect(verifyPaystackSignature(body, "abc", "sk_test")).toBe(false);
    expect(verifyPaystackSignature(body, sign(body, ""), "")).toBe(false);
  });
});

describe("mapPaystackTx", () => {
  it("maps statuses, minor units and reusable authorizations", () => {
    expect(mapPaystackTx({ status: "success", amount: 750000, currency: "NGN", authorization: { authorization_code: "AUTH_x", reusable: true } })).toEqual({ status: "SUCCEEDED", amount: 7500, currency: "NGN", authorizationCode: "AUTH_x" });
    expect(mapPaystackTx({ status: "success", amount: 500, currency: "USD", authorization: { authorization_code: "AUTH_y", reusable: false } }).authorizationCode).toBeUndefined();
    expect(mapPaystackTx({ status: "failed", amount: 1, currency: "NGN" }).status).toBe("FAILED");
    expect(mapPaystackTx({ status: "abandoned", amount: 1, currency: "NGN" }).status).toBe("FAILED");
    expect(mapPaystackTx({ status: "ongoing", amount: 1, currency: "NGN" }).status).toBe("PENDING");
    expect(mapPaystackTx(undefined).status).toBe("PENDING");
  });
});

describe("isRenewalDue", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  const base = { status: "ACTIVE", autoRenew: true, authorizationCode: "AUTH", currentPeriodEnd: new Date(now.getTime() + 3_600_000), lastRenewalAttemptAt: null as Date | null };
  it("is due within a day of the end date", () => expect(isRenewalDue(base, now)).toBe(true));
  it("is not due when far from expiry", () => expect(isRenewalDue({ ...base, currentPeriodEnd: new Date(now.getTime() + RENEW_AHEAD_MS + 1000) }, now)).toBe(false));
  it("retries after expiry within the grace window, then gives up", () => {
    expect(isRenewalDue({ ...base, currentPeriodEnd: new Date(now.getTime() - GRACE_MS + 1000) }, now)).toBe(true);
    expect(isRenewalDue({ ...base, currentPeriodEnd: new Date(now.getTime() - GRACE_MS - 1000) }, now)).toBe(false);
  });
  it("throttles retries", () => {
    expect(isRenewalDue({ ...base, lastRenewalAttemptAt: new Date(now.getTime() - RETRY_EVERY_MS + 1000) }, now)).toBe(false);
    expect(isRenewalDue({ ...base, lastRenewalAttemptAt: new Date(now.getTime() - RETRY_EVERY_MS - 1000) }, now)).toBe(true);
  });
  it("never charges without auto-renew, a saved card, or an active status", () => {
    expect(isRenewalDue({ ...base, autoRenew: false }, now)).toBe(false);
    expect(isRenewalDue({ ...base, authorizationCode: null }, now)).toBe(false);
    expect(isRenewalDue({ ...base, status: "CANCELED" }, now)).toBe(false);
  });
});

describe("cronAuthorized", () => {
  const req = (h?: string) => new Request("http://x/api/cron", { headers: h ? { authorization: h } : {} });
  it("fails closed without CRON_SECRET, checks the bearer token otherwise", () => {
    const old = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    expect(cronAuthorized(req("Bearer x")).status).toBe(503);
    process.env.CRON_SECRET = "s3cret";
    expect(cronAuthorized(req("Bearer s3cret")).ok).toBe(true);
    expect(cronAuthorized(req("Bearer nope")).status).toBe(401);
    expect(cronAuthorized(req()).status).toBe(401);
    process.env.CRON_SECRET = old;
  });
});

describe("mock provider checkout URL", () => {
  it("is built from the callback's origin for both billing and marketplace callbacks", async () => {
    const { mockProvider } = await import("@/lib/payments/mock");
    for (const cb of ["http://localhost:3000/billing/callback?reference=r1", "http://localhost:3000/market/callback?reference=mp_r1"]) {
      const r = await mockProvider.createCheckout({ reference: "r1", amount: 5, currency: "USD", email: "a@b.c", callbackUrl: cb });
      expect(r.url).toBe("http://localhost:3000/billing/mock?reference=r1");
    }
  });
});
