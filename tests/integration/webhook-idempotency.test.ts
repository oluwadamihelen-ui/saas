import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";

/**
 * The webhook route (src/app/api/webhooks/[provider]/route.ts) relies on
 * this unique constraint to guarantee a (provider, eventId) pair is
 * processed at most once, even if the provider retries delivery. This test
 * exercises the DB-level guarantee directly.
 */
describe("PaymentWebhookEvent idempotency", () => {
  const eventId = `evt_test_${Date.now()}`;

  afterAll(async () => {
    await prisma.paymentWebhookEvent.deleteMany({ where: { eventId } });
  });

  it("allows the first delivery of an event", async () => {
    const record = await prisma.paymentWebhookEvent.create({
      data: { provider: "mock", eventId, eventType: "charge.success", payload: { ok: true } },
    });
    expect(record.eventId).toBe(eventId);
  });

  it("rejects a second delivery of the same (provider, eventId) pair", async () => {
    await expect(
      prisma.paymentWebhookEvent.create({
        data: { provider: "mock", eventId, eventType: "charge.success", payload: { ok: true } },
      })
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("allows the same eventId under a different provider (composite key, not eventId alone)", async () => {
    const record = await prisma.paymentWebhookEvent.create({
      data: { provider: "paystack", eventId, eventType: "charge.success", payload: { ok: true } },
    });
    expect(record.provider).toBe("paystack");
    await prisma.paymentWebhookEvent.delete({ where: { id: record.id } });
  });
});
