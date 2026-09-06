import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require";
import { getOrderForCustomer } from "@/lib/services/orders";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const order = await getOrderForCustomer(id, user.id);
  if (!order) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-muted">Placed {formatDate(order.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={order.status} />
          <StatusBadge status={order.paymentStatus} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardContent>
            <p className="mb-4 text-sm font-semibold text-foreground">Items</p>
            <div className="divide-y divide-border">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{item.description}</p>
                    <p className="text-xs text-muted">
                      Qty {item.quantity} · {item.billingCycle.replace("_", " ").toLowerCase()}
                    </p>
                  </div>
                  <span className="font-medium">{formatCurrency(Number(item.total), order.currency)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
              <div className="flex justify-between text-muted">
                <span>Subtotal</span>
                <span>{formatCurrency(Number(order.subtotal), order.currency)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Discount</span>
                <span>-{formatCurrency(Number(order.discount), order.currency)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Tax</span>
                <span>{formatCurrency(Number(order.tax), order.currency)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold text-foreground">
                <span>Total</span>
                <span>{formatCurrency(Number(order.total), order.currency)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {order.invoice && (
            <Card>
              <CardContent>
                <p className="text-sm font-semibold text-foreground">Invoice</p>
                <p className="mt-2 text-sm text-muted">{order.invoice.invoiceNumber}</p>
                <Button asChild size="sm" variant="secondary" className="mt-4 w-full">
                  <Link href={`/dashboard/invoices/${order.invoice.id}`}>View Invoice</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {order.deployments.length > 0 && (
            <Card>
              <CardContent>
                <p className="text-sm font-semibold text-foreground">Deployments</p>
                <div className="mt-3 space-y-2">
                  {order.deployments.map((d) => (
                    <Link
                      key={d.id}
                      href={`/dashboard/deployments/${d.id}`}
                      className="flex items-center justify-between rounded-md border border-border p-3 text-sm hover:bg-muted-surface"
                    >
                      <span>Deployment</span>
                      <StatusBadge status={d.status} />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent>
              <p className="text-sm font-semibold text-foreground">Billing Details</p>
              <dl className="mt-3 space-y-1 text-sm text-muted">
                <div className="flex justify-between">
                  <dt>Name</dt>
                  <dd className="text-foreground">{order.billingName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Email</dt>
                  <dd className="text-foreground">{order.billingEmail}</dd>
                </div>
                {order.billingCompany && (
                  <div className="flex justify-between">
                    <dt>Company</dt>
                    <dd className="text-foreground">{order.billingCompany}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
