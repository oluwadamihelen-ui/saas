import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { confirmMockPayment } from "./actions";

export default async function MockPayPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; orderId?: string; amount?: string }>;
}) {
  const { ref, orderId } = await searchParams;
  if (!ref || !orderId) notFound();

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) notFound();

  return (
    <div className="container-shell flex justify-center py-16">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-8">
        <div className="mb-6 flex items-center justify-center gap-2 rounded-md bg-warning-soft px-3 py-2 text-xs font-medium text-warning">
          Demo Mode — no real charge will be made
        </div>
        <h1 className="text-xl font-semibold">Complete your payment</h1>
        <p className="mt-1 text-sm text-muted">Order {order.orderNumber}</p>

        <div className="mt-6 space-y-2 border-y border-border py-4 text-sm">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between">
              <span className="text-muted">{item.description}</span>
              <span>{formatCurrency(Number(item.total), order.currency)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-between text-lg font-semibold">
          <span>Total</span>
          <span>{formatCurrency(Number(order.total), order.currency)}</span>
        </div>

        <form action={confirmMockPayment} className="mt-8">
          <input type="hidden" name="ref" value={ref} />
          <input type="hidden" name="orderId" value={orderId} />
          <Button type="submit" size="lg" className="w-full">
            Pay {formatCurrency(Number(order.total), order.currency)}
          </Button>
        </form>
      </div>
    </div>
  );
}
