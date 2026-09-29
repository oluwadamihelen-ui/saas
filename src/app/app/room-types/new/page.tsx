import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoomTypeForm } from "../room-type-form";
import { createRoomTypeAction } from "../actions";

export const metadata: Metadata = { title: "New Room Type" };

export default async function NewRoomTypePage() {
  await requirePermission(PERMISSIONS.ROOMS_MANAGE);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">New Room Type</h1>
      <Card>
        <CardHeader>
          <CardTitle>Room type details</CardTitle>
        </CardHeader>
        <CardContent>
          <RoomTypeForm action={createRoomTypeAction} submitLabel="Create Room Type" />
        </CardContent>
      </Card>
    </div>
  );
}
