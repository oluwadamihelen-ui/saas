import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRoom } from "@/lib/services/rooms";
import { listRoomTypes } from "@/lib/services/room-types";
import { RoomForm } from "../../room-form";
import { updateRoomAction } from "../../actions";

export const metadata: Metadata = { title: "Edit Room" };

export default async function EditRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(PERMISSIONS.ROOMS_MANAGE);
  const { id } = await params;
  const [room, roomTypes] = await Promise.all([getRoom(user.hotelId, id), listRoomTypes(user.hotelId)]);
  if (!room) notFound();

  const boundAction = updateRoomAction.bind(null, room.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Edit Room {room.roomNumber}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Room details</CardTitle>
        </CardHeader>
        <CardContent>
          <RoomForm
            action={boundAction}
            submitLabel="Save Changes"
            roomTypes={roomTypes}
            redirectTo={`/app/rooms/${room.id}`}
            defaultValues={{
              roomTypeId: room.roomTypeId,
              roomNumber: room.roomNumber,
              floor: room.floor ?? "",
              price: room.price ? Number(room.price) : "",
              amenities: room.amenities.join("\n"),
              description: room.description ?? "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
