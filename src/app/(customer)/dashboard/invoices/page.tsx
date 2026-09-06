import Link from "next/link";
import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { requireUser } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage() {
  const user = await requireUser();
  const invoices = await prisma.invoice.findMany({ where: { customerId: user.id }, orderBy: { issuedAt: "desc" } });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>

      {invoices.length === 0 ? (
        <EmptyState icon={<FileText className="h-8 w-8" />} title="No invoices yet" description="Invoices are generated automatically after payment." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-border bg-muted-surface text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Issued</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-muted-surface">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/invoices/${invoice.id}`} className="font-medium text-accent">
                      {invoice.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDate(invoice.issuedAt)}</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(Number(invoice.total), invoice.currency)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={invoice.status} />
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
