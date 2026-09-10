import Link from "next/link";
import type { Metadata } from "next";
import { CreditCard } from "lucide-react";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Pagination } from "@/components/ui/pagination";
import { formatCurrency, formatDate } from "@/lib/utils";
import { listPayments } from "@/lib/services/payments";
import type { PaymentMethod } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Payments" };

const METHODS: PaymentMethod[] = ["CASH", "BANK_TRANSFER", "CARD", "POS", "ONLINE_PAYMENT", "PAYMENT_LINK", "OTHER"];

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ method?: string; search?: string; page?: string }> }) {
  const user = await requirePermission(PERMISSIONS.PAYMENTS_VIEW);
  const params = await searchParams;
  const currency = user.hotelCurrency ?? "USD";

  const { items, page, pageCount, totalAmount } = await listPayments(user.hotelId, {
    method: params.method && METHODS.includes(params.method as PaymentMethod) ? (params.method as PaymentMethod) : undefined,
    search: params.search,
    page: params.page ? Number(params.page) : 1,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <Card>
          <CardContent className="px-4 py-2">
            <p className="text-xs text-muted">Total (filtered)</p>
            <p className="text-lg font-semibold text-foreground">{formatCurrency(totalAmount, currency)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <form action="/app/payments" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted">Search</label>
              <Input name="search" defaultValue={params.search} placeholder="Reference or guest name" className="w-64" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted">Method</label>
              <Select name="method" defaultValue={params.method} className="w-48">
                <option value="">All methods</option>
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m.replaceAll("_", " ")}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="secondary">
              Filter
            </Button>
          </form>
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <EmptyState icon={<CreditCard className="h-6 w-6" />} title="No payments recorded" description="Payments recorded against reservations will appear here." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted-surface text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3">Reference</th>
                  <th className="px-5 py-3">Guest</th>
                  <th className="px-5 py-3">Reservation</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Received By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((p) => (
                  <tr key={p.id} className="hover:bg-muted-surface/50">
                    <td className="px-5 py-3 font-medium text-foreground">{p.reference}</td>
                    <td className="px-5 py-3 text-muted">
                      {p.guest.firstName} {p.guest.lastName}
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {p.reservation ? (
                        <Link href={`/app/reservations/${p.reservation.id}`} className="text-accent">
                          {p.reservation.reference}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted">{p.method.replaceAll("_", " ")}</td>
                    <td className="px-5 py-3 font-medium text-foreground">{formatCurrency(p.amount, currency)}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-5 py-3 text-muted">{formatDate(p.paymentDate)}</td>
                    <td className="px-5 py-3 text-muted">{p.receivedBy?.name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination basePath="/app/payments" page={page} pageCount={pageCount} searchParams={params} />
        </Card>
      )}
    </div>
  );
}
