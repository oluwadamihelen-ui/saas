import Link from "next/link";
import type { Metadata } from "next";
import { CalendarCheck, Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Pagination } from "@/components/ui/pagination";
import { formatCurrency, formatDate } from "@/lib/utils";
import { listReservations } from "@/lib/services/reservations";
import type { ReservationStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Reservations" };

const STATUSES: ReservationStatus[] = ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"];

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<{ status?: string; search?: string; page?: string }> }) {
  const user = await requirePermission(PERMISSIONS.RESERVATIONS_VIEW);
  const params = await searchParams;
  const currency = user.hotelCurrency ?? "USD";

  const { items, page, pageCount } = await listReservations(user.hotelId, {
    status: params.status && STATUSES.includes(params.status as ReservationStatus) ? (params.status as ReservationStatus) : undefined,
    search: params.search,
    page: params.page ? Number(params.page) : 1,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Reservations</h1>
        <Button asChild>
          <Link href="/app/reservations/new">
            <Plus className="h-4 w-4" /> New Reservation
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent>
          <form action="/app/reservations" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted">Search</label>
              <Input name="search" defaultValue={params.search} placeholder="Reference, guest, room..." className="w-64" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted">Status</label>
              <Select name="status" defaultValue={params.status} className="w-48">
                <option value="">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll("_", " ")}
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
        <EmptyState icon={<CalendarCheck className="h-6 w-6" />} title="No reservations found" description="Create a reservation to get started." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted-surface text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3">Reference</th>
                  <th className="px-5 py-3">Guest</th>
                  <th className="px-5 py-3">Room</th>
                  <th className="px-5 py-3">Dates</th>
                  <th className="px-5 py-3">Total</th>
                  <th className="px-5 py-3">Balance</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((r) => (
                  <tr key={r.id} className="hover:bg-muted-surface/50">
                    <td className="px-5 py-3 font-medium text-foreground">{r.reference}</td>
                    <td className="px-5 py-3 text-muted">
                      {r.guest.firstName} {r.guest.lastName}
                    </td>
                    <td className="px-5 py-3 text-muted">{r.room.roomNumber}</td>
                    <td className="px-5 py-3 text-muted">
                      {formatDate(r.checkInDate)} – {formatDate(r.checkOutDate)}
                    </td>
                    <td className="px-5 py-3 text-muted">{formatCurrency(r.totalAmount, currency)}</td>
                    <td className="px-5 py-3 text-muted">{formatCurrency(r.balance, currency)}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/app/reservations/${r.id}`} className="text-xs font-medium text-accent">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination basePath="/app/reservations" page={page} pageCount={pageCount} searchParams={params} />
        </Card>
      )}
    </div>
  );
}
