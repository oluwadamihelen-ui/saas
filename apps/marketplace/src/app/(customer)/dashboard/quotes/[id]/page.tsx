import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatCurrency } from "@/lib/utils";
import { acceptQuote, rejectQuote } from "../actions";

export default async function CustomerQuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const quote = await prisma.quote.findFirst({ where: { id, customerId: user.id }, include: { items: true } });
  if (!quote) notFound();

  const isPending = quote.status === "SENT" && (!quote.expiresAt || quote.expiresAt > new Date());
  const accept = acceptQuote.bind(null, quote.id);
  const reject = rejectQuote.bind(null, quote.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quote {quote.quoteNumber}</h1>
          <p className="mt-1 text-sm text-muted">
            Received {formatDate(quote.createdAt)}
            {quote.expiresAt ? ` · Valid until ${formatDate(quote.expiresAt)}` : ""}
          </p>
        </div>
        <StatusBadge status={quote.status} />
      </div>

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

          {isPending && (
            <div className="mt-6 flex gap-2">
              <form action={accept} className="flex-1">
                <Button type="submit" size="lg" className="w-full">
                  Accept &amp; Pay
                </Button>
              </form>
              <form action={reject}>
                <Button type="submit" size="lg" variant="secondary">
                  Decline
                </Button>
              </form>
            </div>
          )}
          {quote.status === "ACCEPTED" && quote.orderId && (
            <p className="mt-6 rounded-md bg-success-soft p-3 text-sm text-success">
              Accepted and paid.{" "}
              <a href={`/dashboard/orders/${quote.orderId}`} className="font-medium underline">
                View order
              </a>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
