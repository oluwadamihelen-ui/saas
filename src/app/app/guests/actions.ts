"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { createGuest, updateGuest } from "@/lib/services/guests";

const guestSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email").optional().or(z.literal("")),
  address: z.string().trim().max(300).optional(),
  nationality: z.string().trim().max(100).optional(),
  idType: z.string().trim().max(100).optional(),
  idNumber: z.string().trim().max(100).optional(),
  dateOfBirth: z.string().optional(),
  emergencyContactName: z.string().trim().max(150).optional(),
  emergencyContactPhone: z.string().trim().max(40).optional(),
  preferences: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export interface GuestFormState {
  status: "idle" | "error" | "success";
  message?: string;
  guestId?: string;
}

function toInput(parsed: z.infer<typeof guestSchema>) {
  return {
    ...parsed,
    email: parsed.email || undefined,
    dateOfBirth: parsed.dateOfBirth ? new Date(parsed.dateOfBirth) : null,
  };
}

export async function createGuestAction(_prev: GuestFormState, formData: FormData): Promise<GuestFormState> {
  const user = await requirePermission(PERMISSIONS.GUESTS_MANAGE);
  const parsed = guestSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };

  try {
    const guest = await createGuest(user.hotelId, user.id, toInput(parsed.data));
    revalidatePath("/app/guests");
    return { status: "success", guestId: guest.id };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Unable to create guest." };
  }
}

export async function updateGuestAction(id: string, _prev: GuestFormState, formData: FormData): Promise<GuestFormState> {
  const user = await requirePermission(PERMISSIONS.GUESTS_MANAGE);
  const parsed = guestSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };

  try {
    await updateGuest(user.hotelId, user.id, id, toInput(parsed.data));
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Unable to update guest." };
  }

  revalidatePath("/app/guests");
  revalidatePath(`/app/guests/${id}`);
  return { status: "success", guestId: id };
}
