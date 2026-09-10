"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { createRoomType, updateRoomType, archiveRoomType } from "@/lib/services/room-types";

const roomTypeSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150),
  description: z.string().trim().max(2000).optional(),
  maxGuests: z.coerce.number().int().min(1).max(50),
  numBeds: z.coerce.number().int().min(1).max(20),
  bedType: z.string().trim().max(100).optional(),
  amenities: z.string().optional(),
  basePrice: z.coerce.number().min(0),
});

export interface RoomTypeFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

function parseAmenities(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(/\r?\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createRoomTypeAction(_prev: RoomTypeFormState, formData: FormData): Promise<RoomTypeFormState> {
  const user = await requirePermission(PERMISSIONS.ROOMS_MANAGE);
  const parsed = roomTypeSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };

  try {
    await createRoomType(user.hotelId, user.id, { ...parsed.data, amenities: parseAmenities(parsed.data.amenities) });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Unable to create room type." };
  }

  revalidatePath("/app/room-types");
  return { status: "success" };
}

export async function updateRoomTypeAction(id: string, _prev: RoomTypeFormState, formData: FormData): Promise<RoomTypeFormState> {
  const user = await requirePermission(PERMISSIONS.ROOMS_MANAGE);
  const parsed = roomTypeSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };

  try {
    await updateRoomType(user.hotelId, user.id, id, { ...parsed.data, amenities: parseAmenities(parsed.data.amenities) });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Unable to update room type." };
  }

  revalidatePath("/app/room-types");
  return { status: "success" };
}

export async function archiveRoomTypeAction(id: string) {
  const user = await requirePermission(PERMISSIONS.ROOMS_MANAGE);
  await archiveRoomType(user.hotelId, user.id, id);
  revalidatePath("/app/room-types");
}
