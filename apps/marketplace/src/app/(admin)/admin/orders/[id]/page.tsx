import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Select, Input, Textarea, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { updateOrderStatus, refundOrder } from "../actions";

const ORDER_STATUSES = ["PENDING_PAYMENT", "PAID", "PROCESSING", "AWAITING_CUSTOMER", "IN_PROGRESS", "COMPLETED", "CANCELLED", "REFUNDED"];

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PERMISSIONS.ORDERS_VIEW);
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { customer: true, items: true, payments: { include: { refunds: true } }, deployments: true, invoice: true },
  });
  if (!order) notFound();

  const updateStatus = updateOrderStatus.bind(null, order.id);
  const refund = refundOrder.bind(null, order.id);
  const paidPayment = order.payments.find((p) => p.status === "PAID" || p.status === "PARTIALLY_REFUNDED");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-muted">
            {order.customer.name} ({order.customer.email}) · {formatDate(order.createdAt)}
          </p>
        </div>
        <StatusBadge status={order.paymentStatus} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardContent>
            <p className="mb-4 text-sm font-semibold text-foreground">Items</p>
            <div className="divide-y divide-border">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-3 text-sm">
                  <span className="text-muted">{item.description}</span>
                  <span className="font-medium">{formatCurrency(Number(item.total), order.currency)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between border-t border-border pt-4 text-base font-semibold">
              <span>Total</span>
              <span>{formatCurrency(Number(order.total), order.currency)}</span>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent>
              <p className="mb-3 text-sm font-semibold text-foreground">Order Status</p>
              <form action={updateStatus} className="flex gap-2">
                <Select name="status" defaultValue={order.status}>
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replaceAll("_", " ")}
                    </option>
                  ))}
                </Select>
                <Button type="submit" size="sm">
                  Update
                </Button>
              </form>
            </CardContent>
          </Card>

          {paidPayment && (
            <Card>
              <CardContent>
                <p className="mb-3 text-sm font-semibold text-foreground">Issue Refund</p>
                <form action={refund} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="amount">Amount</Label>
                    <Input id="amount" name="amount" type="number" step="0.01" max={Number(paidPayment.amount)} defaultValue={Number(paidPayment.amount)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reason">Reason</Label>
                    <Textarea id="reason" name="reason" rows={2} required />
                  </div>
                  <Button type="submit" size="sm" variant="destructive">
                    Process Refund
                  </Button>
                </form>
                {order.payments.flatMap((p) => p.refunds).length > 0 && (
                  <div className="mt-4 space-y-2 border-t border-border pt-3 text-xs text-muted">
                    {order.payments.flatMap((p) => p.refunds).map((r) => (
                      <div key={r.id} className="flex justify-between">
                        <span>{r.reason}</span>
                        <span>{formatCurrency(Number(r.amount), order.currency)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent>
              <p className="text-sm font-semibold text-foreground">Payment</p>
              <dl className="mt-2 space-y-1 text-sm text-muted">
                <div className="flex justify-between">
                  <dt>Provider</dt>
                  <dd className="text-foreground">{order.paymentProvider ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Reference</dt>
                  <dd className="text-foreground">{order.transactionRef ?? "—"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
