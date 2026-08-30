import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-helpers";
import { getPaystackSecretForBusiness, verifyTransaction } from "@/lib/payments/paystack";
import { markOrderPaid } from "@/lib/orders";

/**
 * Used by the storefront "thank you" page to show payment status right
 * after the customer returns from Paystack. This independently re-verifies
 * with Paystack's API server-side (never trusts the redirect query string)
 * — it's a convenience for the UI, not the system of record; the webhook
 * above is what actually marks orders paid, and this handler is written to
 * be safely idempotent alongside it.
 */
export async function GET(req: NextRequest) {
  try {
    const reference = req.nextUrl.searchParams.get("reference");
    if (!reference) return NextResponse.json({ error: "reference is required" }, { status: 400 });

    const payment = await prisma.payment.findUnique({ where: { providerReference: reference } });
    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

    if (payment.status === "PAID") {
      return NextResponse.json({ status: "PAID", orderId: payment.orderId });
    }

    const secretKey = await getPaystackSecretForBusiness(payment.businessId);
    if (!secretKey) return NextResponse.json({ error: "Payment provider not configured" }, { status: 422 });

    const tx = await verifyTransaction(reference, secretKey);

    if (tx.status === "success") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "PAID", verifiedAt: new Date(), providerTransactionId: String(tx.id) },
      });
      if (payment.orderId) await markOrderPaid(payment.orderId);
      return NextResponse.json({ status: "PAID", orderId: payment.orderId });
    }

    return NextResponse.json({ status: tx.status.toUpperCase(), orderId: payment.orderId });
  } catch (err) {
    return apiError(err);
  }
}
