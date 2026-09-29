import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRoomType } from "@/lib/services/room-types";
import { RoomTypeForm } from "../room-type-form";
import { updateRoomTypeAction } from "../actions";

export const metadata: Metadata = { title: "Edit Room Type" };

export default async function EditRoomTypePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(PERMISSIONS.ROOMS_MANAGE);
  const { id } = await params;
  const roomType = await getRoomType(user.hotelId, id);
  if (!roomType) notFound();

  const boundAction = updateRoomTypeAction.bind(null, roomType.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Edit {roomType.name}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Room type details</CardTitle>
        </CardHeader>
        <CardContent>
          <RoomTypeForm
            action={boundAction}
            submitLabel="Save Changes"
            defaultValues={{
              name: roomType.name,
              description: roomType.description ?? "",
              maxGuests: roomType.maxGuests,
              numBeds: roomType.numBeds,
              bedType: roomType.bedType ?? "",
              amenities: roomType.amenities.join("\n"),
              basePrice: Number(roomType.basePrice),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
