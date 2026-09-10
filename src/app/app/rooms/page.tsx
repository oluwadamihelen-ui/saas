import Link from "next/link";
import type { Metadata } from "next";
import { BedDouble, Plus } from "lucide-react";
import { requirePermission, requireHotelUser, getUserPermissions } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency } from "@/lib/utils";
import { listRooms, roomStatusCounts, effectiveRoomRate } from "@/lib/services/rooms";
import { listRoomTypes } from "@/lib/services/room-types";
import type { RoomStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Rooms" };

const ROOM_STATUSES: RoomStatus[] = ["AVAILABLE", "RESERVED", "OCCUPIED", "DIRTY", "CLEANING", "INSPECTED", "MAINTENANCE", "OUT_OF_SERVICE"];

export default async function RoomsPage({ searchParams }: { searchParams: Promise<{ status?: string; roomTypeId?: string; search?: string }> }) {
  const user = await requireHotelUser();
  const perms = await getUserPermissions(user.id, user.hotelId);
  const canManage = perms.has(PERMISSIONS.ROOMS_MANAGE);
  await requirePermission(PERMISSIONS.ROOMS_VIEW);

  const params = await searchParams;
  const [rooms, counts, roomTypes] = await Promise.all([
    listRooms(user.hotelId, {
      status: params.status && ROOM_STATUSES.includes(params.status as RoomStatus) ? (params.status as RoomStatus) : undefined,
      roomTypeId: params.roomTypeId || undefined,
      search: params.search || undefined,
    }),
    roomStatusCounts(user.hotelId),
    listRoomTypes(user.hotelId),
  ]);

  const currency = user.hotelCurrency ?? "USD";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Rooms</h1>
        {canManage && (
          <Button asChild>
            <Link href="/app/rooms/new">
              <Plus className="h-4 w-4" /> New Room
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {ROOM_STATUSES.map((status) => (
          <Link
            key={status}
            href={`/app/rooms?status=${status}`}
            className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted hover:border-accent hover:text-accent"
          >
            {status.replaceAll("_", " ")}
            <span className="rounded-full bg-muted-surface px-1.5 text-foreground">{counts[status] ?? 0}</span>
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3">
          <form className="flex flex-wrap items-end gap-3" action="/app/rooms">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted">Search room number</label>
              <Input name="search" defaultValue={params.search} placeholder="e.g. 204" className="w-48" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted">Room type</label>
              <Select name="roomTypeId" defaultValue={params.roomTypeId} className="w-48">
                <option value="">All room types</option>
                {roomTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="secondary">
              Filter
            </Button>
            {(params.status || params.roomTypeId || params.search) && (
              <Button asChild variant="ghost">
                <Link href="/app/rooms">Clear</Link>
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {rooms.length === 0 ? (
        <EmptyState icon={<BedDouble className="h-6 w-6" />} title="No rooms found" description="Create rooms under a room type to start taking reservations." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted-surface text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3">Room</th>
                  <th className="px-5 py-3">Room Type</th>
                  <th className="px-5 py-3">Floor</th>
                  <th className="px-5 py-3">Rate</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rooms.map((room) => (
                  <tr key={room.id} className="hover:bg-muted-surface/50">
                    <td className="px-5 py-3 font-medium text-foreground">{room.roomNumber}</td>
                    <td className="px-5 py-3 text-muted">{room.roomType.name}</td>
                    <td className="px-5 py-3 text-muted">{room.floor ?? "—"}</td>
                    <td className="px-5 py-3 text-muted">{formatCurrency(effectiveRoomRate(room), currency)}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={room.status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/app/rooms/${room.id}`} className="text-xs font-medium text-accent">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
