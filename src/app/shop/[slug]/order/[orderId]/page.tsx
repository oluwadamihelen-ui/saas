import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getPaystackSecretForBusiness, verifyTransaction } from "@/lib/payments/paystack";
import { markOrderPaid } from "@/lib/orders";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; orderId: string }>;
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const { slug, orderId } = await params;
  const { reference: refParam, trxref } = await searchParams;
  const reference = refParam || trxref;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, business: true, customer: true },
  });
  if (!order || order.business.slug !== slug) notFound();

  // Best-effort server-side verification on return, in addition to the webhook.
  if (reference && order.paymentStatus !== "PAID") {
    try {
      const secretKey = await getPaystackSecretForBusiness(order.businessId);
      if (secretKey) {
        const tx = await verifyTransaction(reference, secretKey);
        if (tx.status === "success") {
          await prisma.payment.updateMany({
            where: { providerReference: reference },
            data: { status: "PAID", verifiedAt: new Date(), providerTransactionId: String(tx.id) },
          });
          await markOrderPaid(order.id);
        }
      }
    } catch {
      // Ignore — the webhook remains the system of record.
    }
  }

  const fresh = await prisma.order.findUnique({ where: { id: orderId } });
  const isPaid = fresh?.paymentStatus === "PAID";

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/30 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 text-center">
          <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${isPaid ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700"}`}>
            {isPaid ? <CheckCircle2 className="h-7 w-7" /> : <Clock className="h-7 w-7" />}
          </div>
          <h1 className="mt-6 text-xl font-bold">
            {isPaid ? "✅ Payment received!" : "Payment pending"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Order <span className="font-medium text-foreground">{order.orderNumber}</span>{" "}
            {isPaid ? "has been confirmed. We'll update you when your order is ready." : "is awaiting payment confirmation."}
          </p>
          <div className="mt-6 space-y-1 rounded-lg bg-secondary/50 p-4 text-left text-sm">
            {order.items.map((i) => (
              <div key={i.id} className="flex justify-between">
                <span>{i.quantity}× {i.productName}</span>
                <span>{formatCurrency(i.total.toString(), order.business.currency)}</span>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold">
              <span>Total</span>
              <span>{formatCurrency(order.total.toString(), order.business.currency)}</span>
            </div>
          </div>
          <Button asChild className="mt-6 w-full">
            <Link href={`/shop/${slug}`}>Continue shopping</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
