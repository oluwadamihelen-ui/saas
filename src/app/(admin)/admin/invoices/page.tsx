import type { Metadata } from "next";
import { Download } from "lucide-react";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Invoices" };

export default async function AdminInvoicesPage() {
  await requirePermission(PERMISSIONS.INVOICES_MANAGE);
  const invoices = await prisma.invoice.findMany({ orderBy: { issuedAt: "desc" }, include: { order: { include: { customer: true } } } });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
      {invoices.length === 0 ? (
        <EmptyState title="No invoices yet" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-border bg-muted-surface text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Issued</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-muted-surface">
                  <td className="px-4 py-3 font-medium text-foreground">{invoice.invoiceNumber}</td>
                  <td className="px-4 py-3 text-muted">{invoice.order.customer.name}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(invoice.issuedAt)}</td>
                  <td className="px-4 py-3">{formatCurrency(Number(invoice.total), invoice.currency)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={invoice.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/api/invoices/${invoice.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-accent"
                    >
                      <Download className="h-3.5 w-3.5" /> PDF
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
