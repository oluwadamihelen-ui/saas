import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listRoomTypes } from "@/lib/services/room-types";
import { RoomForm } from "../room-form";
import { createRoomAction } from "../actions";

export const metadata: Metadata = { title: "New Room" };

export default async function NewRoomPage() {
  const user = await requirePermission(PERMISSIONS.ROOMS_MANAGE);
  const roomTypes = await listRoomTypes(user.hotelId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">New Room</h1>
      <Card>
        <CardHeader>
          <CardTitle>Room details</CardTitle>
        </CardHeader>
        <CardContent>
          {roomTypes.length === 0 ? (
            <p className="text-sm text-muted">Create a room type first before adding rooms.</p>
          ) : (
            <RoomForm action={createRoomAction} submitLabel="Create Room" roomTypes={roomTypes} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
