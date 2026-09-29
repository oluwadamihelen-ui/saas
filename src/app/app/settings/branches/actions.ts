"use server";

import { z } from "zod";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { createHotelBranch } from "@/lib/services/hotels";
import { logger } from "@/lib/security/logger";

const branchSchema = z.object({
  hotelName: z.string().trim().min(2, "Hotel name is required").max(150),
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  hotelEmail: z.string().trim().toLowerCase().email("Enter a valid hotel email").optional().or(z.literal("")),
  website: z.string().trim().max(200).optional(),
  currency: z.string().trim().min(3).max(3),
  timezone: z.string().trim().min(1),
  checkInTime: z.string().trim().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Use HH:mm"),
  checkOutTime: z.string().trim().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Use HH:mm"),
  numberOfRooms: z.coerce.number().int().min(1, "Must have at least 1 room").max(5000),
  description: z.string().trim().max(2000).optional(),
});

export interface CreateBranchState {
  status: "idle" | "error" | "success";
  message?: string;
  hotelId?: string;
}

// Gated on settings.manage (same permission the "Hotel information" card
// uses) rather than a new permission key -- Hotel Owners have it and Hotel
// Managers deliberately don't (see lib/auth/permissions.ts), which already
// matches "owners can add branches, managers can't" with no new plumbing.
export async function createBranchAction(_prev: CreateBranchState, formData: FormData): Promise<CreateBranchState> {
  const actor = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  const parsed = branchSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    const hotel = await createHotelBranch(actor.hotelId, actor.id, { ...parsed.data, hotelEmail: parsed.data.hotelEmail || undefined });
    return { status: "success", hotelId: hotel.id };
  } catch (error) {
    logger.error("branches.create_failed", { error: error instanceof Error ? error.message : String(error) });
    return { status: "error", message: error instanceof Error ? error.message : "Unable to create the branch right now." };
  }
}
