import Link from "next/link";
import type { Metadata } from "next";
import { LayoutGrid, Plus, Users, BedDouble } from "lucide-react";
import { requirePermission, requireHotelUser } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils";
import { listRoomTypes } from "@/lib/services/room-types";
import { archiveRoomTypeAction } from "./actions";

export const metadata: Metadata = { title: "Room Types" };

export default async function RoomTypesPage() {
  const user = await requireHotelUser();
  const perms = await getUserPermissions(user.id, user.hotelId);
  const canManage = perms.has(PERMISSIONS.ROOMS_MANAGE);
  await requirePermission(PERMISSIONS.ROOMS_VIEW);

  const roomTypes = await listRoomTypes(user.hotelId, true);
  const currency = user.hotelCurrency ?? "USD";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Room Types</h1>
        {canManage && (
          <Button asChild>
            <Link href="/app/room-types/new">
              <Plus className="h-4 w-4" /> New Room Type
            </Link>
          </Button>
        )}
      </div>

      {roomTypes.length === 0 ? (
        <EmptyState icon={<LayoutGrid className="h-6 w-6" />} title="No room types yet" description="Create your first room type — Standard, Deluxe, Suite — to start adding rooms." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roomTypes.map((rt) => (
            <Card key={rt.id} className={!rt.isActive ? "opacity-60" : undefined}>
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="text-base font-semibold text-foreground">{rt.name}</h3>
                  <span className="text-sm font-semibold text-accent">{formatCurrency(rt.basePrice, currency)}<span className="text-xs font-normal text-muted">/night</span></span>
                </div>
                {rt.description && <p className="line-clamp-2 text-sm text-muted">{rt.description}</p>}
                <div className="flex gap-4 text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {rt.maxGuests} guests
                  </span>
                  <span className="flex items-center gap-1">
                    <BedDouble className="h-3.5 w-3.5" /> {rt.numBeds} bed{rt.numBeds === 1 ? "" : "s"}
                  </span>
                  <span>{rt._count.rooms} room{rt._count.rooms === 1 ? "" : "s"}</span>
                </div>
                {rt.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {rt.amenities.slice(0, 4).map((a) => (
                      <span key={a} className="rounded-full bg-muted-surface px-2 py-0.5 text-[11px] text-muted">
                        {a}
                      </span>
                    ))}
                  </div>
                )}
                {canManage && (
                  <div className="flex gap-2 pt-2">
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/app/room-types/${rt.id}`}>Edit</Link>
                    </Button>
                    {rt.isActive && (
                      <form action={archiveRoomTypeAction.bind(null, rt.id)}>
                        <Button size="sm" variant="ghost" type="submit">
                          Archive
                        </Button>
                      </form>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
