import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPaystackSignature } from "@/lib/payments/paystack";
import { activateFromPayment } from "@/lib/billing";
import { fulfillVerified } from "@/lib/market/orders";

export const dynamic = "force-dynamic";

interface PaystackEvent {
  event: string;
  data?: {
    id?: number | string;
    reference?: string;
    status?: string;
    amount?: number;
    currency?: string;
    authorization?: { authorization_code?: string; reusable?: boolean };
  };
}

/**
 * Paystack webhook. Security: HMAC-SHA512 of the raw body is verified before anything is parsed.
 * Idempotency: payment activation is an atomic claim, and each delivery is logged in WebhookEvent.
 * Amount and currency are checked against OUR payment row — never trusted from the event alone.
 */
export async function POST(req: Request) {
  const secret = process.env.PAYMENT_API_KEY ?? "";
  const raw = await req.text();
  if (!verifyPaystackSignature(raw, req.headers.get("x-paystack-signature"), secret)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let evt: PaystackEvent;
  try {
    evt = JSON.parse(raw) as PaystackEvent;
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }
  const d = evt.data ?? {};
  const eventKey = `${evt.event}:${d.id ?? d.reference ?? "?"}`;

  if (await prisma.webhookEvent.findUnique({ where: { provider_eventKey: { provider: "paystack", eventKey } } })) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  if (evt.event === "charge.success" && d.reference?.startsWith("mp_")) {
    // Marketplace order: amount + currency are checked against OUR order inside fulfillVerified.
    if (d.status === "success" && typeof d.amount === "number" && d.currency) await fulfillVerified(d.reference, { amountMinor: d.amount, currency: d.currency });
  } else if (evt.event === "charge.success" && d.reference) {
    const payment = await prisma.payment.findUnique({ where: { reference: d.reference } });
    if (payment && payment.provider === "paystack" && payment.status !== "SUCCEEDED") {
      const amountOk = typeof d.amount === "number" && Math.round(payment.amount * 100) === d.amount && d.currency === payment.currency;
      if (d.status === "success" && amountOk) {
        const auth = d.authorization?.reusable ? d.authorization.authorization_code : undefined;
        await activateFromPayment(payment.id, { authorizationCode: auth });
      }
      // Mismatched amount/currency: leave the payment pending for manual review rather than granting Pro.
    }
  }

  await prisma.webhookEvent.create({ data: { provider: "paystack", eventKey, type: evt.event } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
