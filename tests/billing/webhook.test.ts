import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { POST as platformPaystackWebhook } from "@/app/api/webhooks/platform-paystack/route";
import { createTestSchool, cleanupTestSchools } from "../helpers/factories";

const TEST_SECRET = "vitest-platform-paystack-secret";
const originalSecretKey = process.env.PLATFORM_PAYSTACK_SECRET_KEY;

beforeAll(() => {
  process.env.PLATFORM_PAYSTACK_SECRET_KEY = TEST_SECRET;
});

afterAll(async () => {
  process.env.PLATFORM_PAYSTACK_SECRET_KEY = originalSecretKey;
  await cleanupTestSchools();
});

afterEach(async () => {
  await prisma.billingEvent.deleteMany({ where: { provider: "PAYSTACK", externalEventId: { startsWith: "vitest-" } } });
});

function signedRequest(body: object) {
  const raw = JSON.stringify(body);
  const signature = crypto.createHmac("sha512", TEST_SECRET).update(raw).digest("hex");
  return new Request("http://localhost/api/webhooks/platform-paystack", {
    method: "POST",
    body: raw,
    headers: { "x-paystack-signature": signature },
  });
}

describe("platform Paystack webhook", () => {
  it("rejects a payload with an invalid signature", async () => {
    const req = new Request("http://localhost/api/webhooks/platform-paystack", {
      method: "POST",
      body: JSON.stringify({ event: "charge.success", data: { reference: "does-not-matter", id: 1 } }),
      headers: { "x-paystack-signature": "not-a-real-signature" },
    });
    const res = await platformPaystackWebhook(req);
    expect(res.status).toBe(401);
  });

  it("marks a PENDING invoice PAID on charge.success and logs a PROCESSED BillingEvent", async () => {
    const { school, subscription } = await createTestSchool({ planTier: "STARTER" });
    const invoice = await prisma.platformInvoice.create({
      data: {
        schoolId: school.id,
        subscriptionId: subscription.id,
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
        amountMinor: 25_000_00,
        dueDate: subscription.currentPeriodEnd,
        status: "PENDING",
        // Deliberately no `provider` set — confirmSubscriptionPayment then
        // takes the mock/simulated-gateway path (skips calling out to the
        // real Paystack API), which is what's actually exercisable without
        // live credentials; the webhook's own signature check and
        // BillingEvent bookkeeping are unaffected by which gateway the
        // invoice itself used.
        providerReference: `vitest-ref-${school.id}`,
      },
    });

    const eventId = `vitest-${school.id}`;
    const res = await platformPaystackWebhook(
      signedRequest({ event: "charge.success", data: { reference: invoice.providerReference, id: eventId } })
    );
    expect(res.status).toBe(200);

    const updatedInvoice = await prisma.platformInvoice.findUnique({ where: { id: invoice.id } });
    expect(updatedInvoice?.status).toBe("PAID");

    const billingEvent = await prisma.billingEvent.findUnique({
      where: { provider_externalEventId: { provider: "PAYSTACK", externalEventId: `${eventId}:charge.success` } },
    });
    expect(billingEvent?.status).toBe("PROCESSED");
  });

  it("is idempotent — a duplicate delivery of the same event does not reprocess", async () => {
    const { school, subscription } = await createTestSchool({ planTier: "STARTER" });
    const invoice = await prisma.platformInvoice.create({
      data: {
        schoolId: school.id,
        subscriptionId: subscription.id,
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
        amountMinor: 25_000_00,
        dueDate: subscription.currentPeriodEnd,
        status: "PENDING",
        providerReference: `vitest-ref-dup-${school.id}`,
      },
    });

    const eventId = `vitest-dup-${school.id}`;
    const payload = { event: "charge.success", data: { reference: invoice.providerReference, id: eventId } };

    const first = await platformPaystackWebhook(signedRequest(payload));
    expect(first.status).toBe(200);
    const second = await platformPaystackWebhook(signedRequest(payload));
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ duplicate: true });

    const events = await prisma.billingEvent.findMany({
      where: { provider: "PAYSTACK", externalEventId: `${eventId}:charge.success` },
    });
    expect(events).toHaveLength(1);
  });

  it("logs an unrecognized reference as IGNORED rather than erroring", async () => {
    const eventId = `vitest-unknown-${Date.now()}`;
    const res = await platformPaystackWebhook(
      signedRequest({ event: "charge.success", data: { reference: "no-such-invoice", id: eventId } })
    );
    expect(res.status).toBe(200);
    const billingEvent = await prisma.billingEvent.findUnique({
      where: { provider_externalEventId: { provider: "PAYSTACK", externalEventId: `${eventId}:charge.success` } },
    });
    expect(billingEvent?.status).toBe("IGNORED");
  });
});
