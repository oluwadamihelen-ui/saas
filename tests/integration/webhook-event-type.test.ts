import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { MockPaymentProvider } from "@/lib/providers/payment/mock";
import { POST } from "@/app/api/webhooks/[provider]/route";

/**
 * Phase 8 regression test: the webhook route must never force a non-charge
 * event (subscription lifecycle, refunds, transfers, ...) through the
 * charge-verification path, since event.providerReference on those events
 * often isn't an Order.transactionRef at all. It should be acknowledged and
 * recorded (for auditability) without ever looking up or touching an order.
 */
const SUFFIX = `webhook-evt-${Date.now()}`;

describe("payment webhook: event-type branching", () => {
  it("acks and ignores a non-charge event without touching any order", async () => {
    const eventId = `evt_${SUFFIX}_sub`;
    const payload = JSON.stringify({ event: "subscription.create", id: eventId, reference: `nonexistent-ref-${SUFFIX}` });
    const signature = MockPaymentProvider.signPayload(payload);

    const req = new NextRequest("http://localhost/api/webhooks/mock", {
      method: "POST",
      headers: { "content-type": "application/json", "x-mock-signature": signature },
      body: payload,
    });

    const res = await POST(req, { params: Promise.resolve({ provider: "mock" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ received: true, ignored: true, type: "subscription.create" });

    const recorded = await prisma.paymentWebhookEvent.findFirst({ where: { provider: "mock", eventId } });
    expect(recorded).not.toBeNull();
    expect(recorded!.orderId).toBeNull();
  });

  it("is idempotent when the same non-charge event is delivered twice", async () => {
    const eventId = `evt_${SUFFIX}_sub_retry`;
    const payload = JSON.stringify({ event: "subscription.disable", id: eventId, reference: `nonexistent-ref-${SUFFIX}-retry` });
    const signature = MockPaymentProvider.signPayload(payload);

    const makeRequest = () =>
      new NextRequest("http://localhost/api/webhooks/mock", {
        method: "POST",
        headers: { "content-type": "application/json", "x-mock-signature": signature },
        body: payload,
      });

    const first = await POST(makeRequest(), { params: Promise.resolve({ provider: "mock" }) });
    expect(first.status).toBe(200);
    const second = await POST(makeRequest(), { params: Promise.resolve({ provider: "mock" }) });
    expect(second.status).toBe(200);

    const count = await prisma.paymentWebhookEvent.count({ where: { provider: "mock", eventId } });
    expect(count).toBe(1);
  });

  it("rejects an unsigned/invalid non-charge event just like a charge event", async () => {
    const payload = JSON.stringify({ event: "refund.processed", id: `evt_${SUFFIX}_bad_sig`, reference: "irrelevant" });

    const req = new NextRequest("http://localhost/api/webhooks/mock", {
      method: "POST",
      headers: { "content-type": "application/json", "x-mock-signature": "not-a-real-signature" },
      body: payload,
    });

    const res = await POST(req, { params: Promise.resolve({ provider: "mock" }) });
    expect(res.status).toBe(401);
  });
}, 30000);
