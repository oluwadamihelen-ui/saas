import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { markOrderPaid } from "@/lib/services/orders";
import { fulfillOrder } from "@/lib/services/fulfillment";
import { MockPaymentProvider } from "@/lib/providers/payment/mock";
import { PaystackPaymentProvider } from "@/lib/providers/payment/paystack";
import { PaymentProvider } from "@/lib/providers/payment/types";
import { logger } from "@/lib/security/logger";

const SIGNATURE_HEADERS: Record<string, string> = {
  mock: "x-mock-signature",
  paystack: "x-paystack-signature",
};

async function resolveProvider(key: string): Promise<PaymentProvider | null> {
  if (key === "mock") return new MockPaymentProvider();
  if (key === "paystack") {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) return null;
    return new PaystackPaymentProvider(secretKey);
  }
  return null;
}

/**
 * Payment providers call this URL, not the browser. We never trust a
 * frontend-reported "payment successful" state -- every order is only
 * marked paid after the signature on this webhook body is verified.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerKey } = await params;
  const rawBody = await req.text();
  const signatureHeader = req.headers.get(SIGNATURE_HEADERS[providerKey] ?? "");

  const provider = await resolveProvider(providerKey);
  if (!provider) {
    logger.warn("webhook.unknown_provider", { providerKey });
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  if (!provider.verifyWebhookSignature({ rawBody, signatureHeader })) {
    logger.warn("webhook.signature_invalid", { providerKey });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = provider.parseWebhookEvent(rawBody);
  const verified = await provider.verifyPayment(event.providerReference);

  const order = await prisma.order.findFirst({ where: { transactionRef: event.providerReference } });
  if (!order) {
    logger.warn("webhook.order_not_found", { providerKey, reference: event.providerReference });
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (verified.status === "PAID") {
    await markOrderPaid(order.id, {
      provider: providerKey,
      providerRef: event.providerReference,
      amount: verified.amount || Number(order.total),
      currency: verified.currency || order.currency,
    });
    await fulfillOrder(order.id);
  } else {
    logger.warn("webhook.payment_not_confirmed", { orderId: order.id, status: verified.status });
  }

  return NextResponse.json({ received: true });
}
