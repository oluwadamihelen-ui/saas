import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPaymentProvider } from "@/lib/providers/registry";
import { markOrderPaid } from "@/lib/services/orders";
import { fulfillOrder } from "@/lib/services/fulfillment";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock } from "lucide-react";

export default async function CheckoutCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;
  if (!orderId) notFound();

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) notFound();

  // The webhook is the source of truth. This is a best-effort reconciliation
  // in case the webhook hasn't landed yet by the time the customer is
  // redirected back -- never trust the frontend alone, so we re-verify with
  // the provider rather than accepting a query-string "success" flag.
  if (order.paymentStatus !== "PAID" && order.transactionRef) {
    try {
      const provider = await getPaymentProvider();
      const verification = await provider.verifyPayment(order.transactionRef);
      if (verification.status === "PAID") {
        await markOrderPaid(order.id, {
          provider: order.paymentProvider ?? provider.key,
          providerRef: order.transactionRef,
          amount: verification.amount || Number(order.total),
          currency: verification.currency || order.currency,
        });
        await fulfillOrder(order.id);
      }
    } catch {
      // Swallow -- the page below reflects whatever the current DB state is.
    }
  }

  const finalOrder = await prisma.order.findUnique({ where: { id: orderId } });
  const isPaid = finalOrder?.paymentStatus === "PAID";

  return (
    <div className="container-shell flex justify-center py-20">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-8 text-center">
        {isPaid ? (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
            <h1 className="mt-4 text-xl font-semibold">Payment successful</h1>
            <p className="mt-2 text-sm text-muted">
              Order {finalOrder?.orderNumber} is confirmed. We&apos;ve started getting your deployment ready.
            </p>
          </>
        ) : (
          <>
            <Clock className="mx-auto h-12 w-12 text-warning" />
            <h1 className="mt-4 text-xl font-semibold">Payment pending</h1>
            <p className="mt-2 text-sm text-muted">
              We haven&apos;t confirmed your payment yet. This page will update automatically once it clears.
            </p>
          </>
        )}
        <Button asChild className="mt-6 w-full">
          <Link href={`/dashboard/orders/${orderId}`}>View Order</Link>
        </Button>
      </div>
    </div>
  );
}
