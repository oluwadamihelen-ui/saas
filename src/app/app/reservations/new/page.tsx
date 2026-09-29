import type { Metadata } from "next";
import { requirePermission, requireHotelUser } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listRoomTypes } from "@/lib/services/room-types";
import { NewReservationForm } from "./new-reservation-form";

export const metadata: Metadata = { title: "New Reservation" };

export default async function NewReservationPage() {
  await requirePermission(PERMISSIONS.RESERVATIONS_MANAGE);
  const user = await requireHotelUser();
  const roomTypes = await listRoomTypes(user.hotelId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">New Reservation</h1>
      <NewReservationForm roomTypes={roomTypes} currency={user.hotelCurrency ?? "USD"} />
    </div>
  );
}
