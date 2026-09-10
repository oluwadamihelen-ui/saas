"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { createWalkIn } from "@/lib/services/front-desk";
import type { PaymentMethod } from "@/generated/prisma/enums";

const walkInSchema = z.object({
  roomId: z.string().min(1, "Select a room"),
  checkInDate: z.string().min(1),
  checkOutDate: z.string().min(1),
  adults: z.coerce.number().int().min(1).max(20),
  children: z.coerce.number().int().min(0).max(20).default(0),
  firstName: z.string().trim().min(1, "Guest first name is required"),
  lastName: z.string().trim().min(1, "Guest last name is required"),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  paymentAmount: z.coerce.number().min(0).default(0),
  paymentMethod: z.custom<PaymentMethod>((v) => typeof v === "string").optional(),
  checkInNow: z.string().optional(),
});

export interface WalkInFormState {
  status: "idle" | "error" | "success";
  message?: string;
  reservationId?: string;
}

export async function createWalkInAction(_prev: WalkInFormState, formData: FormData): Promise<WalkInFormState> {
  const user = await requirePermission(PERMISSIONS.CHECKIN_MANAGE);
  const parsed = walkInSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };

  try {
    const { reservation } = await createWalkIn(user.hotelId, user.id, {
      guest: { firstName: parsed.data.firstName, lastName: parsed.data.lastName, phone: parsed.data.phone, email: parsed.data.email || undefined },
      reservation: {
        roomId: parsed.data.roomId,
        checkInDate: new Date(parsed.data.checkInDate),
        checkOutDate: new Date(parsed.data.checkOutDate),
        adults: parsed.data.adults,
        children: parsed.data.children,
      },
      payment: parsed.data.paymentAmount > 0 && parsed.data.paymentMethod ? { amount: parsed.data.paymentAmount, method: parsed.data.paymentMethod } : undefined,
      checkInNow: parsed.data.checkInNow === "on",
    });

    revalidatePath("/app/front-desk");
    revalidatePath("/app/reservations");
    return { status: "success", reservationId: reservation.id };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Unable to register walk-in guest." };
  }
}
