import type { Metadata } from "next";
import { requirePermission, requireHotelUser } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listRoomTypes } from "@/lib/services/room-types";
import { WalkInForm } from "./walk-in-form";

export const metadata: Metadata = { title: "New Walk-in" };

export default async function WalkInPage() {
  await requirePermission(PERMISSIONS.CHECKIN_MANAGE);
  const user = await requireHotelUser();
  const roomTypes = await listRoomTypes(user.hotelId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">New Walk-in Guest</h1>
      <WalkInForm roomTypes={roomTypes} currency={user.hotelCurrency ?? "USD"} />
    </div>
  );
}
