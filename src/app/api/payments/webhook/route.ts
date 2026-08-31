import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaystackSecretForBusiness, getPlatformPaystackSecret, verifyWebhookSignature } from "@/lib/payments/paystack";
import { markOrderPaid } from "@/lib/orders";
import { creditWallet, isWalletModeBusiness } from "@/lib/wallet";

type PaystackEvent = {
  event: string;
  data: {
    id: number;
    reference: string;
    status: string;
    amount: number;
    transfer_code?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  };
};

/**
 * Paystack webhook — the only place a payment (or a payout) is ever
 * trusted as successful/failed. Frontend redirects are advisory only.
 * Two independent event families land here:
 *  - charge.* — customer payments, matched to a Payment row, verified
 *    against that business's own Paystack key (or the platform key, when
 *    that business is in wallet mode and has none of its own).
 *  - transfer.* — payouts to a merchant's bank account, matched to a
 *    PayoutRequest, always verified against the platform key since payouts
 *    only ever happen on the platform's own Paystack account.
 * Idempotent via WebhookEvent's (source, externalId) unique constraint.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-paystack-signature");

  let event: PaystackEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (event.event?.startsWith("transfer.")) {
    return handleTransferEvent(rawBody, signatureHeader, event);
  }
  return handleChargeEvent(rawBody, signatureHeader, event);
}

async function handleChargeEvent(rawBody: string, signatureHeader: string | null, event: PaystackEvent) {
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
      // Wallet-mode businesses don't have their own Paystack account, so
      // the money just landed in the platform's pooled account — credit
      // their internal balance rather than assuming Paystack pays them.
      if (await isWalletModeBusiness(payment.businessId)) {
        await creditWallet(payment.businessId, payment.amount, "SALE_CREDIT", {
          orderId: payment.orderId ?? undefined,
          description: `Sale — ${reference}`,
        });
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

async function handleTransferEvent(rawBody: string, signatureHeader: string | null, event: PaystackEvent) {
  const platformKey = getPlatformPaystackSecret();
  if (!platformKey || !verifyWebhookSignature(rawBody, signatureHeader, platformKey)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const transferCode = event.data.transfer_code;
  const payout = transferCode
    ? await prisma.payoutRequest.findUnique({ where: { paystackTransferCode: transferCode } })
    : null;
  if (!payout) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const externalId = String(event.data.id);

  try {
    await prisma.webhookEvent.create({
      data: {
        businessId: payout.businessId,
        source: "PAYSTACK",
        externalId,
        eventType: event.event,
        payload: event as never,
      },
    });
  } catch {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    if (event.event === "transfer.success") {
      await prisma.payoutRequest.update({ where: { id: payout.id }, data: { status: "PAID", processedAt: new Date() } });
      await prisma.notification.create({
        data: {
          businessId: payout.businessId,
          type: "PAYMENT_SUCCESS",
          title: "Withdrawal paid",
          body: `Your withdrawal of ${payout.amount} ${payout.currency} has been sent to your bank account.`,
        },
      });
    } else if (event.event === "transfer.failed" || event.event === "transfer.reversed") {
      // The debit already happened when the payout was requested — refund it now that Paystack confirms it didn't go through.
      if (payout.status !== "FAILED" && payout.status !== "REVERSED") {
        await creditWallet(payout.businessId, payout.amount, "WITHDRAWAL_REVERSAL", {
          payoutId: payout.id,
          description: `Withdrawal reversed — ${event.data.reason ?? "transfer failed"}`,
        });
      }
      await prisma.payoutRequest.update({
        where: { id: payout.id },
        data: {
          status: event.event === "transfer.reversed" ? "REVERSED" : "FAILED",
          failureReason: event.data.reason ?? null,
          processedAt: new Date(),
        },
      });
      await prisma.notification.create({
        data: {
          businessId: payout.businessId,
          type: "PAYMENT_FAILURE",
          title: "Withdrawal failed",
          body: `Your withdrawal of ${payout.amount} ${payout.currency} could not be completed and has been refunded to your wallet.`,
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
