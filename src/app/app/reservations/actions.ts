"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { searchAvailableRooms } from "@/lib/services/availability";
import { createReservation } from "@/lib/services/reservations";
import { findOrCreateGuestByContact } from "@/lib/services/guests";
import { confirmReservation, cancelReservation, markNoShow, extendStay, transferRoom } from "@/lib/services/reservations";
import { checkInReservation, checkOutReservation } from "@/lib/services/front-desk";
import { addCharge, removeCharge } from "@/lib/services/additional-charges";
import { recordPayment } from "@/lib/services/payments";
import type { ChargeType, PaymentMethod, ReservationSource } from "@/generated/prisma/enums";

export interface AvailabilitySearchResult {
  status: "idle" | "error" | "success";
  message?: string;
  rooms?: { id: string; roomNumber: string; floor: string | null; roomTypeName: string; rate: number }[];
}

const searchSchema = z.object({
  checkInDate: z.string().min(1),
  checkOutDate: z.string().min(1),
  guests: z.coerce.number().int().min(1).max(50).optional(),
  roomTypeId: z.string().optional(),
});

export async function searchAvailabilityAction(_prev: AvailabilitySearchResult, formData: FormData): Promise<AvailabilitySearchResult> {
  const user = await requirePermission(PERMISSIONS.RESERVATIONS_VIEW);
  const parsed = searchSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };

  try {
    const rooms = await searchAvailableRooms(user.hotelId, {
      checkInDate: new Date(parsed.data.checkInDate),
      checkOutDate: new Date(parsed.data.checkOutDate),
      guests: parsed.data.guests,
      roomTypeId: parsed.data.roomTypeId || undefined,
    });
    return {
      status: "success",
      rooms: rooms.map((r) => ({ id: r.id, roomNumber: r.roomNumber, floor: r.floor, roomTypeName: r.roomType.name, rate: Number(r.price ?? r.roomType.basePrice) })),
    };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Unable to search availability." };
  }
}

const reservationSchema = z.object({
  roomId: z.string().min(1, "Select a room"),
  checkInDate: z.string().min(1),
  checkOutDate: z.string().min(1),
  adults: z.coerce.number().int().min(1).max(20),
  children: z.coerce.number().int().min(0).max(20).default(0),
  discount: z.coerce.number().min(0).default(0),
  source: z.custom<ReservationSource>((v) => typeof v === "string"),
  notes: z.string().trim().max(1000).optional(),
  firstName: z.string().trim().min(1, "Guest first name is required"),
  lastName: z.string().trim().min(1, "Guest last name is required"),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
});

export interface ReservationFormState {
  status: "idle" | "error" | "success";
  message?: string;
  reservationId?: string;
}

export async function createReservationAction(_prev: ReservationFormState, formData: FormData): Promise<ReservationFormState> {
  const user = await requirePermission(PERMISSIONS.RESERVATIONS_MANAGE);
  const parsed = reservationSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };

  try {
    const guest = await findOrCreateGuestByContact(user.hotelId, user.id, {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone: parsed.data.phone,
      email: parsed.data.email || undefined,
    });

    const reservation = await createReservation(user.hotelId, user.id, {
      guestId: guest.id,
      roomId: parsed.data.roomId,
      checkInDate: new Date(parsed.data.checkInDate),
      checkOutDate: new Date(parsed.data.checkOutDate),
      adults: parsed.data.adults,
      children: parsed.data.children,
      discount: parsed.data.discount,
      source: parsed.data.source,
      notes: parsed.data.notes,
      confirmImmediately: parsed.data.source !== "ONLINE",
    });

    revalidatePath("/app/reservations");
    return { status: "success", reservationId: reservation.id };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Unable to create reservation." };
  }
}

export async function confirmReservationAction(id: string) {
  const user = await requirePermission(PERMISSIONS.RESERVATIONS_MANAGE);
  await confirmReservation(user.hotelId, user.id, id);
  revalidatePath(`/app/reservations/${id}`);
}

export async function cancelReservationAction(id: string, reason: string) {
  const user = await requirePermission(PERMISSIONS.RESERVATIONS_MANAGE);
  await cancelReservation(user.hotelId, user.id, id, reason);
  revalidatePath(`/app/reservations/${id}`);
  revalidatePath("/app/reservations");
}

export async function markNoShowAction(id: string) {
  const user = await requirePermission(PERMISSIONS.RESERVATIONS_MANAGE);
  await markNoShow(user.hotelId, user.id, id);
  revalidatePath(`/app/reservations/${id}`);
}

export async function extendStayAction(id: string, newCheckOutDate: string) {
  const user = await requirePermission(PERMISSIONS.RESERVATIONS_MANAGE);
  await extendStay(user.hotelId, user.id, id, new Date(newCheckOutDate));
  revalidatePath(`/app/reservations/${id}`);
}

export async function transferRoomAction(id: string, toRoomId: string, reason: string) {
  const user = await requirePermission(PERMISSIONS.RESERVATIONS_MANAGE);
  await transferRoom(user.hotelId, user.id, id, toRoomId, reason);
  revalidatePath(`/app/reservations/${id}`);
}

export async function checkInAction(id: string) {
  const user = await requirePermission(PERMISSIONS.CHECKIN_MANAGE);
  await checkInReservation(user.hotelId, user.id, id);
  revalidatePath(`/app/reservations/${id}`);
  revalidatePath("/app/front-desk");
}

export async function checkOutAction(id: string, paymentAmount: number, paymentMethod: PaymentMethod | null, allowOutstandingBalance: boolean) {
  const user = await requirePermission(PERMISSIONS.CHECKIN_MANAGE);
  await checkOutReservation(user.hotelId, user.id, id, {
    payment: paymentAmount > 0 && paymentMethod ? { amount: paymentAmount, method: paymentMethod } : undefined,
    allowOutstandingBalance,
  });
  revalidatePath(`/app/reservations/${id}`);
  revalidatePath("/app/front-desk");
}

export async function addChargeAction(reservationId: string, type: ChargeType, description: string, amount: number) {
  const user = await requirePermission(PERMISSIONS.RESERVATIONS_MANAGE);
  await addCharge(user.hotelId, user.id, { reservationId, type, description, amount });
  revalidatePath(`/app/reservations/${reservationId}`);
}

export async function removeChargeAction(reservationId: string, chargeId: string) {
  const user = await requirePermission(PERMISSIONS.RESERVATIONS_MANAGE);
  await removeCharge(user.hotelId, user.id, chargeId);
  revalidatePath(`/app/reservations/${reservationId}`);
}

export async function recordPaymentAction(reservationId: string, guestId: string, amount: number, method: PaymentMethod, notes: string) {
  const user = await requirePermission(PERMISSIONS.PAYMENTS_MANAGE);
  await recordPayment(user.hotelId, user.id, { guestId, reservationId, amount, method, notes: notes || undefined });
  revalidatePath(`/app/reservations/${reservationId}`);
}
