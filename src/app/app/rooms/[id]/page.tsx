import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { requirePermission, requireHotelUser, getUserPermissions } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getRoom, listRoomStatusHistory, effectiveRoomRate } from "@/lib/services/rooms";
import { RoomStatusControl } from "../room-status-control";

export const metadata: Metadata = { title: "Room Details" };

export default async function RoomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireHotelUser();
  const perms = await getUserPermissions(user.id, user.hotelId);
  const canManage = perms.has(PERMISSIONS.ROOMS_MANAGE);
  await requirePermission(PERMISSIONS.ROOMS_VIEW);

  const { id } = await params;
  const [room, history] = await Promise.all([getRoom(user.hotelId, id), listRoomStatusHistory(user.hotelId, id)]);
  if (!room) notFound();

  const currency = user.hotelCurrency ?? "USD";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Room {room.roomNumber}</h1>
          <p className="text-sm text-muted">{room.roomType.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={room.status} />
          {canManage && (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/app/rooms/${room.id}/edit`}>Edit</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted">Floor</p>
              <p className="text-sm text-foreground">{room.floor ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Rate per night</p>
              <p className="text-sm text-foreground">{formatCurrency(effectiveRoomRate(room), currency)}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-muted">Description</p>
              <p className="text-sm text-foreground">{room.description || "—"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-muted">Amenities</p>
              {room.amenities.length === 0 ? (
                <p className="text-sm text-muted">None listed</p>
              ) : (
                <div className="mt-1 flex flex-wrap gap-1">
                  {room.amenities.map((a) => (
                    <span key={a} className="rounded-full bg-muted-surface px-2 py-0.5 text-xs text-muted">
                      {a}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>Change status</CardTitle>
            </CardHeader>
            <CardContent>
              <RoomStatusControl roomId={room.id} currentStatus={room.status} />
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">No status changes recorded yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm text-foreground">
                      {h.fromStatus ? `${h.fromStatus.replaceAll("_", " ")} → ` : ""}
                      {h.toStatus.replaceAll("_", " ")}
                    </p>
                    <p className="text-xs text-muted">
                      {h.reason ?? "No reason given"} · {h.changedBy?.name ?? "System"} · {formatDate(h.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
