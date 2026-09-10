import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { confirmSubscriptionPayment } from "@/lib/billing/payment-provider";

/// Schoolum's own Paystack webhook — for schools paying THEIR subscription
/// to Schoolum, distinct from /api/webhooks/paystack (a school's own
/// gateway, for collecting fees from its parents). Signed against a
/// single platform-wide secret key (env), not a per-school one, since
/// there's exactly one merchant account on this side.
export async function POST(req: Request) {
  const rawBody = await req.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const event = parsed as { event?: string; data?: { reference?: string; id?: number } };

  const secretKey = process.env.PLATFORM_PAYSTACK_SECRET_KEY;
  if (!secretKey) return NextResponse.json({ error: "Platform gateway not configured" }, { status: 404 });

  const signature = req.headers.get("x-paystack-signature");
  const expected = crypto.createHmac("sha512", secretKey).update(rawBody).digest("hex");
  if (!signature || signature !== expected) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const reference = event.data?.reference;
  if (!reference) return NextResponse.json({ error: "Missing reference" }, { status: 400 });

  // Idempotency: Paystack's transaction id is stable per charge and unique
  // per event type, so a retried delivery finds its own prior row here and
  // is a no-op rather than double-applying a payment (spec: authenticated,
  // idempotent, logged webhook handling).
  const externalEventId = `${event.data?.id ?? reference}:${event.event ?? "unknown"}`;
  const invoice = await prisma.platformInvoice.findUnique({ where: { providerReference: reference } });

  const existing = await prisma.billingEvent.findUnique({
    where: { provider_externalEventId: { provider: "PAYSTACK", externalEventId } },
  });
  if (existing) return NextResponse.json({ received: true, duplicate: true });

  const billingEvent = await prisma.billingEvent.create({
    data: {
      provider: "PAYSTACK",
      externalEventId,
      eventType: event.event ?? "unknown",
      schoolId: invoice?.schoolId ?? null,
      subscriptionId: invoice?.subscriptionId ?? null,
      payload: parsed as object,
      status: "RECEIVED",
    },
  });

  if (!invoice) {
    await prisma.billingEvent.update({ where: { id: billingEvent.id }, data: { status: "IGNORED", processedAt: new Date() } });
    return NextResponse.json({ received: true });
  }

  if (event.event === "charge.success") {
    try {
      await confirmSubscriptionPayment(reference);
      await prisma.billingEvent.update({ where: { id: billingEvent.id }, data: { status: "PROCESSED", processedAt: new Date() } });
    } catch (error) {
      await prisma.billingEvent.update({
        where: { id: billingEvent.id },
        data: { status: "FAILED", processedAt: new Date(), errorMessage: error instanceof Error ? error.message : "Unknown error" },
      });
    }
  } else {
    await prisma.billingEvent.update({ where: { id: billingEvent.id }, data: { status: "IGNORED", processedAt: new Date() } });
  }

  return NextResponse.json({ received: true });
}
