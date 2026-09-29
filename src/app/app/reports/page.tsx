import Link from "next/link";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard, StatCardGrid } from "@/components/ui/stat-card";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  occupancyReport,
  revenueReport,
  reservationsReport,
  roomPerformanceReport,
  guestStatisticsReport,
  expensesReport,
  popularRoomTypesReport,
  profitEstimate,
} from "@/lib/services/reports";
import { listOutstandingReservations } from "@/lib/services/payments";
import { OccupancyChart } from "@/components/charts/occupancy-chart";
import { RevenueChart } from "@/components/charts/revenue-chart";

export const metadata: Metadata = { title: "Reports" };

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function endOfDay(date: Date) {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

const RANGE_OPTIONS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
];

function resolveRange(range: string | undefined, from?: string, to?: string) {
  const today = startOfDay(new Date());
  if (range === "week") {
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());
    return { from: start, to: endOfDay(new Date()) };
  }
  if (range === "month") {
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    return { from: start, to: endOfDay(new Date()) };
  }
  if (range === "custom" && from && to) {
    return { from: startOfDay(new Date(from)), to: endOfDay(new Date(to)) };
  }
  return { from: today, to: endOfDay(new Date()) };
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  const user = await requirePermission(PERMISSIONS.REPORTS_VIEW);
  const params = await searchParams;
  const currency = user.hotelCurrency ?? "USD";
  const range = resolveRange(params.range, params.from, params.to);
  const activeRange = params.range ?? "today";

  const [occupancy, revenue, reservations, roomPerformance, guestStats, expenses, popularRoomTypes, profit, outstanding] = await Promise.all([
    occupancyReport(user.hotelId, range),
    revenueReport(user.hotelId, range),
    reservationsReport(user.hotelId, range),
    roomPerformanceReport(user.hotelId, range),
    guestStatisticsReport(user.hotelId, range),
    expensesReport(user.hotelId, range),
    popularRoomTypesReport(user.hotelId, range),
    profitEstimate(user.hotelId, range),
    listOutstandingReservations(user.hotelId),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <div className="flex gap-2">
          {RANGE_OPTIONS.map((opt) => (
            <Link
              key={opt.key}
              href={`/app/reports?range=${opt.key}`}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-medium",
                activeRange === opt.key ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-foreground"
              )}
            >
              {opt.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-muted">
          Showing {formatDate(range.from)} – {formatDate(range.to)}
        </p>
        <form action="/app/reports" className="flex items-center gap-2">
          <input type="hidden" name="range" value="custom" />
          <input type="date" name="from" defaultValue={params.from} className="h-8 rounded-md border border-border bg-surface px-2 text-xs" />
          <span className="text-xs text-muted">to</span>
          <input type="date" name="to" defaultValue={params.to} className="h-8 rounded-md border border-border bg-surface px-2 text-xs" />
          <button type="submit" className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted hover:text-foreground">
            Apply
          </button>
        </form>
      </div>

      <StatCardGrid>
        <StatCard label="Revenue" value={formatCurrency(revenue.total, currency)} />
        <StatCard label="Expenses" value={formatCurrency(expenses.total, currency)} />
        <StatCard label="Estimated Profit" value={formatCurrency(profit.estimatedProfit, currency)} />
        <StatCard label="Avg. Occupancy" value={`${occupancy.averageOccupancyRate}%`} />
      </StatCardGrid>
      <p className="text-xs text-muted">
        Estimated profit is revenue collected minus recorded expenses in this window — not an accounting-grade profit figure (it does not account for
        accruals, taxes, or depreciation).
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Occupancy</CardTitle>
          </CardHeader>
          <CardContent>
            {occupancy.series.length > 0 ? <OccupancyChart data={occupancy.series} /> : <p className="py-16 text-center text-sm text-muted">No data for this period.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Day</CardTitle>
          </CardHeader>
          <CardContent>
            {revenue.byDay.length > 0 ? <RevenueChart data={revenue.byDay.map((d) => ({ date: d.date, value: d.amount }))} currency={currency} /> : <p className="py-16 text-center text-sm text-muted">No payments in this period.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Reservations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Total created" value={String(reservations.total)} />
            <Row label="Check-ins" value={String(reservations.checkIns)} />
            <Row label="Check-outs" value={String(reservations.checkOuts)} />
            <Row label="Cancellations" value={String(reservations.cancellations)} />
            <Row label="No-shows" value={String(reservations.noShows)} />
            {reservations.bySource.map((s) => (
              <Row key={s.source} label={s.source.replaceAll("_", " ")} value={String(s.count)} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {revenue.byMethod.length === 0 ? (
              <p className="text-muted">No payments in this period.</p>
            ) : (
              revenue.byMethod.map((m) => <Row key={m.method} label={m.method.replaceAll("_", " ")} value={formatCurrency(m.amount, currency)} />)
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expenses by Category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {expenses.byCategory.length === 0 ? (
              <p className="text-muted">No expenses in this period.</p>
            ) : (
              expenses.byCategory.map((c) => <Row key={c.category} label={c.category.replaceAll("_", " ")} value={formatCurrency(c.total, currency)} />)
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Room Performance</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {roomPerformance.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">No stays overlap this period.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted-surface text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-5 py-2">Room</th>
                    <th className="px-5 py-2">Nights Sold</th>
                    <th className="px-5 py-2">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {roomPerformance.slice(0, 10).map((r) => (
                    <tr key={r.roomNumber}>
                      <td className="px-5 py-2 text-foreground">
                        {r.roomNumber} <span className="text-xs text-muted">({r.roomType})</span>
                      </td>
                      <td className="px-5 py-2 text-muted">{r.nightsSold}</td>
                      <td className="px-5 py-2 text-muted">{formatCurrency(r.revenue, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Popular Room Types</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {popularRoomTypes.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">No bookings in this period.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted-surface text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-5 py-2">Room Type</th>
                    <th className="px-5 py-2">Bookings</th>
                    <th className="px-5 py-2">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {popularRoomTypes.map((rt) => (
                    <tr key={rt.name}>
                      <td className="px-5 py-2 text-foreground">{rt.name}</td>
                      <td className="px-5 py-2 text-muted">{rt.bookings}</td>
                      <td className="px-5 py-2 text-muted">{formatCurrency(rt.revenue, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Guest Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="New guests" value={String(guestStats.newGuests)} />
            <Row label="Total guests on file" value={String(guestStats.totalGuests)} />
            <Row label="Repeat guests" value={String(guestStats.repeatGuests)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Outstanding Payments</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {outstanding.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">No outstanding balances.</p>
            ) : (
              <ul className="divide-y divide-border">
                {outstanding.slice(0, 8).map((r) => (
                  <li key={r.id} className="flex items-center justify-between px-5 py-2 text-sm">
                    <span className="text-foreground">
                      {r.guest.firstName} {r.guest.lastName} · Room {r.room.roomNumber}
                    </span>
                    <span className="font-medium text-danger">{formatCurrency(r.balance, currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
