import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-helpers";
import { markOrderPaid } from "@/lib/orders";
import { generateOrderNumber } from "@/lib/utils";
import { creditWallet, isWalletModeBusiness } from "@/lib/wallet";

const schema = z.object({ orderId: z.string() });

/**
 * Development-only fallback so the end-to-end order → payment → inventory
 * loop can be demoed without real Paystack credentials. This never runs in
 * production, and only runs at all when the business hasn't connected its
 * OWN Paystack account — so a live integration is never silently bypassed.
 * (A wallet-mode business with no account of its own is exactly the case
 * this exists for, and still gets its wallet credited like a real sale
 * would.) See README "Known limitations" for why this exists.
 */
export async function POST(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Not available in production" }, { status: 403 });
    }

    const { orderId } = schema.parse(await req.json());
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.paymentStatus === "PAID") return NextResponse.json({ status: "PAID" });

    const walletMode = await isWalletModeBusiness(order.businessId);
    if (!walletMode) {
      return NextResponse.json(
        { error: "Paystack is connected for this business — use the real checkout flow instead." },
        { status: 422 }
      );
    }

    await prisma.payment.create({
      data: {
        businessId: order.businessId,
        orderId: order.id,
        provider: "MANUAL",
        providerReference: `DEV-${generateOrderNumber()}`,
        amount: order.total,
        currency: "NGN",
        status: "PAID",
        verifiedAt: new Date(),
      },
    });

    await markOrderPaid(orderId);
    await creditWallet(order.businessId, order.total, "SALE_CREDIT", {
      orderId: order.id,
      description: "Dev-simulated sale",
    });

    return NextResponse.json({ status: "PAID" });
  } catch (err) {
    return apiError(err);
  }
}
