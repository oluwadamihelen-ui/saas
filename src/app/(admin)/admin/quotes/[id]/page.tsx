import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, formatCurrency } from "@/lib/utils";

export default async function AdminQuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PERMISSIONS.QUOTES_MANAGE);
  const { id } = await params;

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { customer: true, items: true, order: true, requests: true },
  });
  if (!quote) notFound();

  const request = quote.requests[0];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quote {quote.quoteNumber}</h1>
          <p className="mt-1 text-sm text-muted">
            {quote.customer.name} ({quote.customer.email}) · Sent {formatDate(quote.createdAt)}
            {quote.expiresAt ? ` · Valid until ${formatDate(quote.expiresAt)}` : ""}
          </p>
        </div>
        <StatusBadge status={quote.status} />
      </div>

      {request && (
        <p className="text-sm text-muted">
          For{" "}
          <Link href={`/admin/quotes/requests/${request.id}`} className="text-accent hover:underline">
            custom work request
          </Link>
        </p>
      )}

      <Card>
        <CardContent>
          <div className="divide-y divide-border">
            {quote.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-3 text-sm">
                <span className="text-muted">
                  {item.description} × {item.quantity}
                </span>
                <span className="font-medium text-foreground">{formatCurrency(Number(item.total), quote.currency)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Subtotal</span>
              <span>{formatCurrency(Number(quote.subtotal), quote.currency)}</span>
            </div>
            {Number(quote.discount) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted">Discount</span>
                <span>-{formatCurrency(Number(quote.discount), quote.currency)}</span>
              </div>
            )}
            {Number(quote.tax) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted">Tax</span>
                <span>{formatCurrency(Number(quote.tax), quote.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span>{formatCurrency(Number(quote.total), quote.currency)}</span>
            </div>
          </div>

          {quote.status === "ACCEPTED" && quote.orderId && (
            <p className="mt-6 rounded-md bg-success-soft p-3 text-sm text-success">
              Accepted and paid.{" "}
              <Link href={`/admin/orders/${quote.orderId}`} className="font-medium underline">
                View order
              </Link>
            </p>
          )}
          {quote.status === "REJECTED" && <p className="mt-6 rounded-md bg-muted-surface p-3 text-sm text-muted">Declined by customer.</p>}
          {quote.status === "EXPIRED" && <p className="mt-6 rounded-md bg-muted-surface p-3 text-sm text-muted">This quote expired before it was accepted.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
