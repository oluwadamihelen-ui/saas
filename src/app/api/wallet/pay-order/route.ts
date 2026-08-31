import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBusinessMembership } from "@/lib/tenant";
import { apiError } from "@/lib/api-helpers";
import { transferBetweenWallets } from "@/lib/wallet";
import { markOrderPaid } from "@/lib/orders";

const schema = z.object({
  orderId: z.string(),
  buyerBusinessId: z.string(),
});

/**
 * Pays for an order using the buyer's own MAMA wallet balance instead of a
 * real Paystack charge — only available when the buyer is logged into
 * their own MAMA business account (a wallet belongs to a business, not an
 * anonymous storefront customer). No real money moves; it's a re-
 * attribution between two ledgers on the same pooled platform account.
 */
export async function POST(req: NextRequest) {
  try {
    const data = schema.parse(await req.json());
    // Confirms the caller is actually signed into buyerBusinessId — never
    // trust buyerBusinessId from the client beyond this check.
    await requireBusinessMembership(data.buyerBusinessId);

    const order = await prisma.order.findUnique({ where: { id: data.orderId }, include: { business: true } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.paymentStatus === "PAID") {
      return NextResponse.json({ error: "This order has already been paid" }, { status: 409 });
    }
    if (order.businessId === data.buyerBusinessId) {
      return NextResponse.json({ error: "You can't pay your own order with your own wallet" }, { status: 400 });
    }

    // Unique constraint on providerReference is the concurrency guard —
    // a duplicate click/request fails here before any balance moves.
    let payment;
    try {
      payment = await prisma.payment.create({
        data: {
          businessId: order.businessId,
          orderId: order.id,
          provider: "WALLET",
          providerReference: `WALLET-${order.id}`,
          amount: order.total,
          currency: order.business.currency,
          status: "PENDING",
          metadata: { buyerBusinessId: data.buyerBusinessId },
        },
      });
    } catch {
      return NextResponse.json({ error: "This order is already being paid" }, { status: 409 });
    }

    try {
      await transferBetweenWallets(data.buyerBusinessId, order.businessId, order.total, order.id);
    } catch (err) {
      await prisma.payment.delete({ where: { id: payment.id } });
      throw err;
    }

    await prisma.payment.update({ where: { id: payment.id }, data: { status: "PAID", verifiedAt: new Date() } });
    const updatedOrder = await markOrderPaid(order.id);

    return NextResponse.json({ order: updatedOrder });
  } catch (err) {
    return apiError(err);
  }
}
