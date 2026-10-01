import { createHmac } from "crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { activateFromPayment } from "@/lib/billing";
import { renewDueSubscriptions } from "@/lib/renewals";
import { POST as paystackWebhook } from "@/app/api/webhooks/paystack/route";
import { PRICING } from "@/config/plans";
import { cleanup, hasDb, makeUser } from "./helpers";

const SECRET = "sk_test_webhook";
const users: string[] = [];
afterAll(() => cleanup(users));

async function pending(userId: string, over: Record<string, unknown> = {}) {
  return prisma.payment.create({
    data: { userId, provider: "paystack", reference: `ref_${Math.random().toString(36).slice(2)}`, amount: PRICING.MONTHLY.ngn, currency: "NGN", interval: "MONTHLY", status: "PENDING", ...over },
  });
}

function hook(body: object, secret = SECRET, sigOverride?: string) {
  const raw = JSON.stringify(body);
  return new Request("http://localhost/api/webhooks/paystack", {
    method: "POST",
    headers: { "x-paystack-signature": sigOverride ?? createHmac("sha512", secret).update(raw).digest("hex"), "content-type": "application/json" },
    body: raw,
  });
}
const success = (p: { reference: string; amount: number; currency: string }, id = Math.floor(Math.random() * 1e9)) => ({
  event: "charge.success",
  data: { id, reference: p.reference, status: "success", amount: Math.round(p.amount * 100), currency: p.currency, authorization: { authorization_code: "AUTH_abc", reusable: true } },
});

describe.skipIf(!hasDb)("paystack webhook", () => {
  beforeEach(() => { process.env.PAYMENT_API_KEY = SECRET; });

  it("rejects bad signatures and does not touch the payment", async () => {
    const u = await makeUser(); users.push(u.id);
    const p = await pending(u.id);
    const res = await paystackWebhook(hook(success(p), SECRET, "deadbeef"));
    expect(res.status).toBe(401);
    expect((await prisma.payment.findUnique({ where: { id: p.id } }))?.status).toBe("PENDING");
    expect(await prisma.subscription.count({ where: { userId: u.id } })).toBe(0);
  });

  it("activates Pro on a valid charge.success, saves the card authorization", async () => {
    const u = await makeUser(); users.push(u.id);
    const p = await pending(u.id);
    const res = await paystackWebhook(hook(success(p)));
    expect(res.status).toBe(200);
    const sub = await prisma.subscription.findFirstOrThrow({ where: { userId: u.id } });
    expect(sub.status).toBe("ACTIVE");
    expect(sub.authorizationCode).toBe("AUTH_abc");
    expect(sub.autoRenew).toBe(true);
    expect(sub.currentPeriodEnd.getTime()).toBeGreaterThan(Date.now() + 30 * 86_400_000);
    const pay = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
    expect(pay.status).toBe("SUCCEEDED");
    expect(pay.paidAt).not.toBeNull();
  });

  it("is idempotent: a replayed event (same id) or a re-sent payment never extends twice", async () => {
    const u = await makeUser(); users.push(u.id);
    const p = await pending(u.id);
    const base = 700_000_000 + Math.floor(Math.random() * 1e8);
    const evt = success(p, base);
    await paystackWebhook(hook(evt));
    const first = (await prisma.subscription.findFirstOrThrow({ where: { userId: u.id } })).currentPeriodEnd.getTime();
    const dup = await paystackWebhook(hook(evt));
    expect((await dup.json()).duplicate).toBe(true);
    await paystackWebhook(hook(success(p, base + 1))); // different event id, same payment
    expect((await prisma.subscription.findFirstOrThrow({ where: { userId: u.id } })).currentPeriodEnd.getTime()).toBe(first);
    expect(await prisma.subscription.count({ where: { userId: u.id } })).toBe(1);
  });

  it("survives concurrent deliveries (atomic claim)", async () => {
    const u = await makeUser(); users.push(u.id);
    const p = await pending(u.id);
    await Promise.all([1, 2, 3, 4].map((i) => paystackWebhook(hook(success(p, 800_000_000 + Math.floor(Math.random() * 1e8) + i)))));
    const subs = await prisma.subscription.findMany({ where: { userId: u.id } });
    expect(subs).toHaveLength(1);
    const days = (subs[0].currentPeriodEnd.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(30);
    expect(days).toBeLessThan(32); // one month, not four
  });

  it("does not grant Pro when the amount or currency doesn't match our records", async () => {
    const u = await makeUser(); users.push(u.id);
    const p = await pending(u.id);
    await paystackWebhook(hook({ ...success(p), data: { ...success(p).data, amount: 100 } }));
    await paystackWebhook(hook({ ...success(p), data: { ...success(p).data, currency: "USD" } }));
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("PENDING");
    expect(await prisma.subscription.count({ where: { userId: u.id } })).toBe(0);
  });

  it("ignores unknown references and other providers' payments, and non-success events", async () => {
    const u = await makeUser(); users.push(u.id);
    const other = await pending(u.id, { provider: "mock" });
    expect((await paystackWebhook(hook(success({ reference: "nope", amount: 1, currency: "NGN" })))).status).toBe(200);
    await paystackWebhook(hook(success(other)));
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: other.id } })).status).toBe("PENDING");
    const p = await pending(u.id);
    await paystackWebhook(hook({ event: "charge.failed", data: { id: 1, reference: p.reference } }));
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("PENDING");
  });

  it("rejects malformed JSON with a valid signature", async () => {
    const raw = "{not json";
    const res = await paystackWebhook(new Request("http://x", { method: "POST", headers: { "x-paystack-signature": createHmac("sha512", SECRET).update(raw).digest("hex") }, body: raw }));
    expect(res.status).toBe(400);
  });
});

describe.skipIf(!hasDb)("activateFromPayment", () => {
  it("extends from the current end date when renewing early, and from now when lapsed", async () => {
    const u = await makeUser(); users.push(u.id);
    const sub = await prisma.subscription.create({ data: { userId: u.id, plan: "PRO", interval: "MONTHLY", provider: "paystack", currentPeriodEnd: new Date(Date.now() + 5 * 86_400_000), authorizationCode: "A" } });
    const p1 = await pending(u.id, { subscriptionId: sub.id, renewal: true });
    await activateFromPayment(p1.id);
    const after = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(Math.round((after.currentPeriodEnd.getTime() - Date.now()) / 86_400_000)).toBe(5 + PRICING.MONTHLY.days);
    // lapsed
    await prisma.subscription.update({ where: { id: sub.id }, data: { currentPeriodEnd: new Date(Date.now() - 2 * 86_400_000), status: "ACTIVE" } });
    const p2 = await pending(u.id, { subscriptionId: sub.id, renewal: true });
    await activateFromPayment(p2.id);
    const lapsed = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(Math.round((lapsed.currentPeriodEnd.getTime() - Date.now()) / 86_400_000)).toBe(PRICING.MONTHLY.days);
    expect(lapsed.authorizationCode).toBe("A");
  });
});

describe.skipIf(!hasDb)("renewals (mock provider)", () => {
  beforeEach(() => { process.env.PAYMENT_PROVIDER = "mock"; delete process.env.MOCK_RENEWAL_FAIL; });

  async function dueSub(userId: string, over: Record<string, unknown> = {}) {
    const s = await prisma.subscription.create({ data: { userId, plan: "PRO", interval: "MONTHLY", provider: "mock", currentPeriodEnd: new Date(Date.now() + 3_600_000), authorizationCode: "mock_auth", ...over } });
    await prisma.payment.create({ data: { userId, subscriptionId: s.id, provider: "mock", reference: `seed_${s.id}`, amount: PRICING.MONTHLY.ngn, currency: "NGN", interval: "MONTHLY", status: "SUCCEEDED" } });
    return s;
  }

  it("charges due subscriptions in their original currency and extends the period", async () => {
    const u = await makeUser(); users.push(u.id);
    const s = await dueSub(u.id);
    const r = await renewDueSubscriptions();
    expect(r.renewed).toBeGreaterThanOrEqual(1);
    const after = await prisma.subscription.findUniqueOrThrow({ where: { id: s.id } });
    expect(after.currentPeriodEnd.getTime()).toBeGreaterThan(Date.now() + 30 * 86_400_000);
    const renewal = await prisma.payment.findFirstOrThrow({ where: { subscriptionId: s.id, renewal: true } });
    expect(renewal.status).toBe("SUCCEEDED");
    expect(renewal.currency).toBe("NGN");
    expect(renewal.amount).toBe(PRICING.MONTHLY.ngn);
  });

  it("does not double-charge on an immediate second run", async () => {
    const u = await makeUser(); users.push(u.id);
    const s = await dueSub(u.id);
    await renewDueSubscriptions();
    await renewDueSubscriptions();
    expect(await prisma.payment.count({ where: { subscriptionId: s.id, renewal: true } })).toBe(1);
  });

  it("skips auto-renew-off, card-less and not-yet-due subscriptions", async () => {
    const u = await makeUser(); users.push(u.id);
    const a = await dueSub(u.id, { autoRenew: false });
    const b = await dueSub(u.id, { authorizationCode: null });
    const c = await dueSub(u.id, { currentPeriodEnd: new Date(Date.now() + 10 * 86_400_000) });
    await renewDueSubscriptions();
    for (const s of [a, b, c]) expect(await prisma.payment.count({ where: { subscriptionId: s.id, renewal: true } })).toBe(0);
  });

  it("a declined renewal marks the payment FAILED, leaves access to run out naturally, and notifies", async () => {
    process.env.MOCK_RENEWAL_FAIL = "1";
    const u = await makeUser(); users.push(u.id);
    const s = await dueSub(u.id);
    const before = s.currentPeriodEnd.getTime();
    const notified: string[] = [];
    const r = await renewDueSubscriptions(new Date(), async (id) => { notified.push(id); });
    expect(r.failed).toBeGreaterThanOrEqual(1);
    expect(notified).toContain(u.id);
    expect((await prisma.subscription.findUniqueOrThrow({ where: { id: s.id } })).currentPeriodEnd.getTime()).toBe(before);
    expect((await prisma.payment.findFirstOrThrow({ where: { subscriptionId: s.id, renewal: true } })).status).toBe("FAILED");
  });

  it("expires subscriptions that are past the grace period", async () => {
    const u = await makeUser(); users.push(u.id);
    const s = await prisma.subscription.create({ data: { userId: u.id, plan: "PRO", interval: "MONTHLY", provider: "mock", currentPeriodEnd: new Date(Date.now() - 10 * 86_400_000) } });
    await renewDueSubscriptions();
    expect((await prisma.subscription.findUniqueOrThrow({ where: { id: s.id } })).status).toBe("EXPIRED");
  });
});
