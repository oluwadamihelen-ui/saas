import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { requireUser } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Quotes" };

export default async function CustomerQuotesPage() {
  const user = await requireUser();

  const [requests, quotes] = await Promise.all([
    prisma.customizationRequest.findMany({
      where: { customerId: user.id, status: { in: ["SUBMITTED", "REVIEWING", "DECLINED"] } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.quote.findMany({ where: { customerId: user.id }, orderBy: { createdAt: "desc" } }),
  ]);

  const isEmpty = requests.length === 0 && quotes.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quotes</h1>
          <p className="mt-1 text-sm text-muted">Custom work requests and the quotes we&apos;ve priced for you.</p>
        </div>
        <Button asChild size="sm">
          <Link href="/dashboard/quotes/new">Request Custom Work</Link>
        </Button>
      </div>

      {isEmpty ? (
        <EmptyState
          icon={<MessageSquareText className="h-8 w-8" />}
          title="No requests or quotes yet"
          description="Need something built or customized? Request custom work and we'll follow up with pricing."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {quotes.map((quote) => (
            <Link key={quote.id} href={`/dashboard/quotes/${quote.id}`}>
              <Card className="transition-colors hover:border-accent">
                <CardContent>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-foreground">Quote {quote.quoteNumber}</p>
                      <p className="mt-1 text-xs text-muted">{formatCurrency(Number(quote.total), quote.currency)}</p>
                    </div>
                    <StatusBadge status={quote.status} />
                  </div>
                  <p className="mt-4 text-xs text-muted">Received {formatDate(quote.createdAt)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
          {requests.map((request) => (
            <Link key={request.id} href={`/dashboard/quotes/requests/${request.id}`}>
              <Card className="transition-colors hover:border-accent">
                <CardContent>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-foreground">Custom work request</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted">{request.description}</p>
                    </div>
                    <StatusBadge status={request.status} />
                  </div>
                  <p className="mt-4 text-xs text-muted">Submitted {formatDate(request.createdAt)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
