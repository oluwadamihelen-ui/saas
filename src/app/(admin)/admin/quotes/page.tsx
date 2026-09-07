import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Quotes" };

export default async function AdminQuotesPage() {
  await requirePermission(PERMISSIONS.QUOTES_MANAGE);

  const [requests, quotes] = await Promise.all([
    prisma.customizationRequest.findMany({ orderBy: { createdAt: "desc" }, include: { customer: true } }),
    prisma.quote.findMany({ orderBy: { createdAt: "desc" }, include: { customer: true } }),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Quotes</h1>

      <section>
        <p className="mb-3 text-sm font-semibold text-foreground">Custom work requests</p>
        {requests.length === 0 ? (
          <EmptyState title="No requests yet" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="border-b border-border bg-muted-surface text-left text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests.map((request) => (
                  <tr key={request.id} className="hover:bg-muted-surface">
                    <td className="px-4 py-3 text-muted">
                      <Link href={`/admin/quotes/requests/${request.id}`} className="text-foreground hover:text-accent hover:underline">
                        {request.customer.name}
                      </Link>
                    </td>
                    <td className="max-w-[320px] truncate px-4 py-3 text-muted" title={request.description}>
                      {request.description}
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDate(request.createdAt)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={request.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <p className="mb-3 text-sm font-semibold text-foreground">Quotes sent</p>
        {quotes.length === 0 ? (
          <EmptyState title="No quotes sent yet" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="border-b border-border bg-muted-surface text-left text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Quote #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {quotes.map((quote) => (
                  <tr key={quote.id} className="hover:bg-muted-surface">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <Link href={`/admin/quotes/${quote.id}`} className="hover:text-accent hover:underline">
                        {quote.quoteNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{quote.customer.name}</td>
                    <td className="px-4 py-3 text-muted">{formatCurrency(Number(quote.total), quote.currency)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={quote.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
