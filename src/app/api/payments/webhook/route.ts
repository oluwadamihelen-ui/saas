import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaystackSecretForBusiness, verifyWebhookSignature } from "@/lib/payments/paystack";
import { markOrderPaid } from "@/lib/orders";

/**
 * Paystack webhook — the only place a payment is ever trusted as
 * successful. Frontend "payment complete" redirects are advisory only;
 * this handler independently verifies the signature and the transaction
 * status before mutating anything, and is idempotent via WebhookEvent's
 * (source, externalId) unique constraint.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-paystack-signature");

  let event: {
    event: string;
    data: { id: number; reference: string; status: string; amount: number; metadata?: Record<string, unknown> };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const reference = event?.data?.reference;
  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  const payment = await prisma.payment.findUnique({ where: { providerReference: reference } });
  if (!payment) {
    // Unknown reference — could be a transaction from outside MAMA. Ack so Paystack stops retrying.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const secretKey = await getPaystackSecretForBusiness(payment.businessId);
  if (!secretKey || !verifyWebhookSignature(rawBody, signatureHeader, secretKey)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const externalId = String(event.data.id);

  try {
    await prisma.webhookEvent.create({
      data: {
        businessId: payment.businessId,
        source: "PAYSTACK",
        externalId,
        eventType: event.event,
        payload: event as never,
      },
    });
  } catch {
    // Unique constraint violation on (source, externalId) => already processed.
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    if (event.event === "charge.success" && event.data.status === "success") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "PAID", verifiedAt: new Date(), providerTransactionId: externalId },
      });
      if (payment.orderId) {
        await markOrderPaid(payment.orderId);
      }
    } else if (event.event === "charge.failed") {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
      await prisma.notification.create({
        data: {
          businessId: payment.businessId,
          type: "PAYMENT_FAILURE",
          title: "Payment failed",
          body: `A payment attempt for reference ${reference} failed.`,
        },
      });
    }

    await prisma.webhookEvent.update({
      where: { source_externalId: { source: "PAYSTACK", externalId } },
      data: { processedAt: new Date() },
    });
  } catch (err) {
    await prisma.webhookEvent.update({
      where: { source_externalId: { source: "PAYSTACK", externalId } },
      data: { error: err instanceof Error ? err.message : "Unknown error" },
    });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
