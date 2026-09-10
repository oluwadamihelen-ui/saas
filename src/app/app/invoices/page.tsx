import Link from "next/link";
import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Pagination } from "@/components/ui/pagination";
import { formatCurrency, formatDate } from "@/lib/utils";
import { listInvoices } from "@/lib/services/invoices";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requirePermission(PERMISSIONS.INVOICES_VIEW);
  const params = await searchParams;
  const currency = user.hotelCurrency ?? "USD";
  const { items, page, pageCount } = await listInvoices(user.hotelId, params.page ? Number(params.page) : 1);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>

      {items.length === 0 ? (
        <EmptyState icon={<FileText className="h-6 w-6" />} title="No invoices yet" description="Invoices are generated automatically when a guest checks out." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted-surface text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3">Invoice #</th>
                  <th className="px-5 py-3">Guest</th>
                  <th className="px-5 py-3">Room</th>
                  <th className="px-5 py-3">Total</th>
                  <th className="px-5 py-3">Balance</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Issued</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted-surface/50">
                    <td className="px-5 py-3 font-medium text-foreground">{inv.invoiceNumber}</td>
                    <td className="px-5 py-3 text-muted">
                      {inv.reservation.guest.firstName} {inv.reservation.guest.lastName}
                    </td>
                    <td className="px-5 py-3 text-muted">{inv.reservation.room.roomNumber}</td>
                    <td className="px-5 py-3 text-muted">{formatCurrency(inv.total, currency)}</td>
                    <td className="px-5 py-3 text-muted">{formatCurrency(inv.balance, currency)}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-5 py-3 text-muted">{formatDate(inv.issuedAt)}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-3">
                        <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" className="text-xs font-medium text-accent">
                          PDF
                        </a>
                        <Link href={`/app/reservations/${inv.reservationId}`} className="text-xs font-medium text-accent">
                          Reservation
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination basePath="/app/invoices" page={page} pageCount={pageCount} />
        </Card>
      )}
    </div>
  );
}
