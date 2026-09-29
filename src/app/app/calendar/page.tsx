import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listRooms } from "@/lib/services/rooms";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Reservation Calendar" };

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

const DAYS_VISIBLE = 7;

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ start?: string }> }) {
  const user = await requirePermission(PERMISSIONS.RESERVATIONS_VIEW);
  const params = await searchParams;
  const start = params.start ? startOfDay(new Date(params.start)) : startOfDay(new Date());
  const end = addDays(start, DAYS_VISIBLE);

  const [rooms, reservations] = await Promise.all([
    listRooms(user.hotelId),
    prisma.reservation.findMany({
      where: { hotelId: user.hotelId, status: { notIn: ["CANCELLED", "NO_SHOW"] }, checkInDate: { lt: end }, checkOutDate: { gt: start } },
      include: { guest: true },
    }),
  ]);

  const days = Array.from({ length: DAYS_VISIBLE }, (_, i) => addDays(start, i));
  const prevHref = `/app/calendar?start=${addDays(start, -DAYS_VISIBLE).toISOString().slice(0, 10)}`;
  const nextHref = `/app/calendar?start=${addDays(start, DAYS_VISIBLE).toISOString().slice(0, 10)}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Reservation Calendar</h1>
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href={prevHref}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href={nextHref}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-muted-surface text-left uppercase tracking-wide text-muted">
                <th className="sticky left-0 z-10 bg-muted-surface px-3 py-2">Room</th>
                {days.map((d) => (
                  <th key={d.toISOString()} className="px-3 py-2 text-center">
                    {d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", timeZone: "UTC" })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rooms.map((room) => (
                <tr key={room.id}>
                  <td className="sticky left-0 z-10 bg-surface px-3 py-2 font-medium text-foreground">{room.roomNumber}</td>
                  {days.map((d) => {
                    const dayEnd = addDays(d, 1);
                    const res = reservations.find((r) => r.roomId === room.id && r.checkInDate < dayEnd && r.checkOutDate > d);
                    return (
                      <td key={d.toISOString()} className="px-1 py-1 text-center">
                        {res ? (
                          <Link
                            href={`/app/reservations/${res.id}`}
                            className={cn(
                              "block truncate rounded px-1.5 py-1 text-[11px] font-medium",
                              res.status === "CHECKED_IN" ? "bg-warning-soft text-warning" : "bg-accent-soft text-accent"
                            )}
                            title={`${res.guest.firstName} ${res.guest.lastName}`}
                          >
                            {res.guest.lastName}
                          </Link>
                        ) : (
                          <span className="block rounded bg-success-soft px-1.5 py-1 text-[11px] text-success">Open</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
