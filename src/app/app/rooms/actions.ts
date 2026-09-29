"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { createRoom, updateRoom, setRoomStatus } from "@/lib/services/rooms";
import type { RoomStatus } from "@/generated/prisma/enums";

const roomSchema = z.object({
  roomTypeId: z.string().min(1, "Choose a room type"),
  roomNumber: z.string().trim().min(1, "Room number is required").max(20),
  floor: z.string().trim().max(20).optional(),
  price: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  amenities: z.string().optional(),
  description: z.string().trim().max(1000).optional(),
});

export interface RoomFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

function parseAmenities(raw?: string): string[] {
  if (!raw) return [];
  return raw.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean);
}

export async function createRoomAction(_prev: RoomFormState, formData: FormData): Promise<RoomFormState> {
  const user = await requirePermission(PERMISSIONS.ROOMS_MANAGE);
  const parsed = roomSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };

  try {
    await createRoom(user.hotelId, user.id, {
      roomTypeId: parsed.data.roomTypeId,
      roomNumber: parsed.data.roomNumber,
      floor: parsed.data.floor,
      price: parsed.data.price === "" || parsed.data.price === undefined ? null : parsed.data.price,
      amenities: parseAmenities(parsed.data.amenities),
      description: parsed.data.description,
    });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Unable to create room." };
  }

  revalidatePath("/app/rooms");
  return { status: "success" };
}

export async function updateRoomAction(id: string, _prev: RoomFormState, formData: FormData): Promise<RoomFormState> {
  const user = await requirePermission(PERMISSIONS.ROOMS_MANAGE);
  const parsed = roomSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };

  try {
    await updateRoom(user.hotelId, user.id, id, {
      roomTypeId: parsed.data.roomTypeId,
      roomNumber: parsed.data.roomNumber,
      floor: parsed.data.floor,
      price: parsed.data.price === "" || parsed.data.price === undefined ? null : parsed.data.price,
      amenities: parseAmenities(parsed.data.amenities),
      description: parsed.data.description,
    });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Unable to update room." };
  }

  revalidatePath("/app/rooms");
  revalidatePath(`/app/rooms/${id}`);
  return { status: "success" };
}

export async function overrideRoomStatusAction(id: string, toStatus: RoomStatus, reason: string) {
  const user = await requirePermission(PERMISSIONS.ROOMS_MANAGE);
  await setRoomStatus(user.hotelId, id, toStatus, user.id, reason || "Manual override", { force: true });
  revalidatePath("/app/rooms");
  revalidatePath(`/app/rooms/${id}`);
}
