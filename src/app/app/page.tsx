import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, LogOut, Users, BedDouble, DoorOpen, DoorClosed, SprayCan, DollarSign, AlertCircle, Percent } from "lucide-react";
import { requireHotelUser } from "@/lib/auth/require";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard, StatCardGrid } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getDashboardMetrics, getOccupancySeries, getRevenueSeries } from "@/lib/services/dashboard-metrics";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { OccupancyChart } from "@/components/charts/occupancy-chart";
import { RoomStatusChart } from "@/components/charts/room-status-chart";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireHotelUser();
  const currency = user.hotelCurrency ?? "USD";

  const [metrics, occupancySeries, revenueSeries] = await Promise.all([
    getDashboardMetrics(user.hotelId),
    getOccupancySeries(user.hotelId, 14),
    getRevenueSeries(user.hotelId, 14),
  ]);

  const cards = [
    { label: "Today's Check-ins", value: metrics.todaysCheckIns, icon: CalendarCheck },
    { label: "Today's Check-outs", value: metrics.todaysCheckOuts, icon: LogOut },
    { label: "Current Guests", value: metrics.currentGuests, icon: Users },
    { label: "Available Rooms", value: metrics.availableRooms, icon: DoorOpen },
    { label: "Occupied Rooms", value: metrics.occupiedRooms, icon: DoorClosed },
    { label: "Reserved Rooms", value: metrics.reservedRooms, icon: BedDouble },
    { label: "Rooms Being Cleaned", value: metrics.roomsBeingCleaned, icon: SprayCan },
    { label: "Today's Revenue", value: formatCurrency(metrics.todaysRevenue, currency), icon: DollarSign },
    { label: "Outstanding Payments", value: formatCurrency(metrics.outstandingPayments, currency), icon: AlertCircle },
    { label: "Occupancy Rate", value: `${metrics.occupancyRate}%`, icon: Percent },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted">{user.hotelName}</p>
      </div>

      <StatCardGrid>
        {cards.map((card) => (
          <StatCard key={card.label} label={card.label} value={card.value} icon={card.icon} />
        ))}
      </StatCardGrid>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue (Last 14 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenueSeries} currency={currency} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Room Status</CardTitle>
          </CardHeader>
          <CardContent>
            <RoomStatusChart counts={metrics.roomStatusCounts} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Occupancy Rate (Last 14 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <OccupancyChart data={occupancySeries} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Upcoming Reservations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {metrics.upcomingReservations.length === 0 ? (
              <EmptyState title="No upcoming reservations" className="border-0 py-10" />
            ) : (
              <ul className="divide-y divide-border">
                {metrics.upcomingReservations.map((r) => (
                  <li key={r.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {r.guest.firstName} {r.guest.lastName}
                      </p>
                      <p className="text-xs text-muted">
                        Room {r.room.roomNumber} · {formatDate(r.checkInDate)}
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {metrics.recentPayments.length === 0 ? (
              <EmptyState title="No payments recorded" className="border-0 py-10" />
            ) : (
              <ul className="divide-y divide-border">
                {metrics.recentPayments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {p.guest.firstName} {p.guest.lastName}
                      </p>
                      <p className="text-xs text-muted">
                        {p.method.replaceAll("_", " ")} · {formatDate(p.paymentDate)}
                      </p>
                    </div>
                    <Badge variant="success">{formatCurrency(p.amount, currency)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Recent Check-ins</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {metrics.recentCheckIns.length === 0 ? (
              <EmptyState title="No check-ins yet" className="border-0 py-10" />
            ) : (
              <ul className="divide-y divide-border">
                {metrics.recentCheckIns.map((r) => (
                  <li key={r.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {r.guest.firstName} {r.guest.lastName}
                      </p>
                      <p className="text-xs text-muted">Room {r.room.roomNumber}</p>
                    </div>
                    <Link href={`/app/reservations/${r.id}`} className="text-xs font-medium text-accent">
                      View
                    </Link>
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
