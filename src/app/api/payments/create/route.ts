import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, rateLimit } from "@/lib/api-helpers";
import { getPaystackSecretForBusiness, initializeTransaction } from "@/lib/payments/paystack";

/**
 * Publicly reachable (customers checking out on the storefront or via
 * WhatsApp are not authenticated MAMA users) — protected instead by the
 * order id being an unguessable cuid, a rate limit, and by only ever
 * charging the order's own stored total, never a client-supplied amount.
 */
const schema = z.object({
  orderId: z.string(),
  email: z.string().email().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    if (!rateLimit(`payments:create:${ip}`, 20, 60_000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const { orderId, email } = schema.parse(body);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, business: true },
    });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.paymentStatus === "PAID") {
      return NextResponse.json({ error: "This order has already been paid" }, { status: 409 });
    }

    const secretKey = await getPaystackSecretForBusiness(order.businessId);
    if (!secretKey) {
      return NextResponse.json(
        { error: "This business hasn't connected Paystack yet. Ask the merchant to finish payment setup." },
        { status: 422 }
      );
    }

    const reference = `${order.orderNumber}-${Date.now()}`;
    const amountKobo = Math.round(Number(order.total) * 100);

    const tx = await initializeTransaction({
      secretKey,
      email: email || order.customer.email || `${order.customer.phone.replace(/[^0-9]/g, "")}@guest.mamabusiness.com`,
      amountKobo,
      reference,
      currency: order.business.currency,
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/shop/${order.business.slug}/order/${order.id}`,
      metadata: { orderId: order.id, businessId: order.businessId },
    });

    await prisma.payment.create({
      data: {
        businessId: order.businessId,
        orderId: order.id,
        provider: "PAYSTACK",
        providerReference: reference,
        amount: order.total,
        currency: order.business.currency,
        status: "PENDING",
        customerEmail: email || order.customer.email || undefined,
        customerPhone: order.customer.phone,
      },
    });

    return NextResponse.json({ authorizationUrl: tx.authorization_url, reference });
  } catch (err) {
    return apiError(err);
  }
}
