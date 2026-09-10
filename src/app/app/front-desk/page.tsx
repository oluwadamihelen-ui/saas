import Link from "next/link";
import type { Metadata } from "next";
import { UserPlus } from "lucide-react";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard, StatCardGrid } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getFrontDeskBoard } from "@/lib/services/front-desk";

export const metadata: Metadata = { title: "Front Desk" };

export default async function FrontDeskPage() {
  const user = await requirePermission(PERMISSIONS.CHECKIN_MANAGE);
  const board = await getFrontDeskBoard(user.hotelId);
  const currency = user.hotelCurrency ?? "USD";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Front Desk</h1>
        <Button asChild>
          <Link href="/app/front-desk/walk-in">
            <UserPlus className="h-4 w-4" /> New Walk-in
          </Link>
        </Button>
      </div>

      <StatCardGrid>
        <StatCard label="Arrivals Today" value={board.arrivalsToday.length} />
        <StatCard label="Departures Today" value={board.departuresToday.length} />
        <StatCard label="Current Guests" value={board.currentGuests.length} />
        <StatCard label="Available Rooms" value={board.availableRoomsCount} />
      </StatCardGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Arrivals Today</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {board.arrivalsToday.length === 0 ? (
              <EmptyState title="No arrivals scheduled" className="border-0 py-10" />
            ) : (
              <ul className="divide-y divide-border">
                {board.arrivalsToday.map((r) => (
                  <li key={r.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <Link href={`/app/reservations/${r.id}`} className="text-sm font-medium text-foreground hover:text-accent">
                        {r.guest.firstName} {r.guest.lastName}
                      </Link>
                      <p className="text-xs text-muted">Room {r.room.roomNumber} · {r.roomType.name}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Departures Today</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {board.departuresToday.length === 0 ? (
              <EmptyState title="No departures scheduled" className="border-0 py-10" />
            ) : (
              <ul className="divide-y divide-border">
                {board.departuresToday.map((r) => (
                  <li key={r.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <Link href={`/app/reservations/${r.id}`} className="text-sm font-medium text-foreground hover:text-accent">
                        {r.guest.firstName} {r.guest.lastName}
                      </Link>
                      <p className="text-xs text-muted">Room {r.room.roomNumber} · Balance {formatCurrency(r.balance, currency)}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Guests</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {board.currentGuests.length === 0 ? (
              <EmptyState title="No guests currently in-house" className="border-0 py-10" />
            ) : (
              <ul className="divide-y divide-border">
                {board.currentGuests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <Link href={`/app/reservations/${r.id}`} className="text-sm font-medium text-foreground hover:text-accent">
                        {r.guest.firstName} {r.guest.lastName}
                      </Link>
                      <p className="text-xs text-muted">Room {r.room.roomNumber} · Until {formatDate(r.checkOutDate)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Outstanding Payments</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {board.outstanding.length === 0 ? (
              <EmptyState title="No outstanding balances" className="border-0 py-10" />
            ) : (
              <ul className="divide-y divide-border">
                {board.outstanding.map((r) => (
                  <li key={r.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <Link href={`/app/reservations/${r.id}`} className="text-sm font-medium text-foreground hover:text-accent">
                        {r.guest.firstName} {r.guest.lastName}
                      </Link>
                      <p className="text-xs text-muted">Room {r.room.roomNumber}</p>
                    </div>
                    <span className="text-sm font-semibold text-danger">{formatCurrency(r.balance, currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {board.noShowCandidates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Possible No-Shows</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {board.noShowCandidates.map((r) => (
                <li key={r.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <Link href={`/app/reservations/${r.id}`} className="text-sm font-medium text-foreground hover:text-accent">
                      {r.guest.firstName} {r.guest.lastName}
                    </Link>
                    <p className="text-xs text-muted">Room {r.room.roomNumber} · Expected {formatDate(r.checkInDate)}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
