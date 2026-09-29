"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { updateHotelSettings } from "@/lib/services/hotels";

const settingsSchema = z.object({
  name: z.string().trim().min(1, "Hotel name is required").max(150),
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  website: z.string().trim().max(200).optional(),
  logoUrl: z.string().trim().max(500).optional(),
  currency: z.string().trim().min(3).max(3),
  timezone: z.string().trim().min(1),
  checkInTime: z.string().trim().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  checkOutTime: z.string().trim().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  taxRatePercent: z.coerce.number().min(0).max(100),
  invoicePrefix: z.string().trim().min(1).max(10),
  reservationPrefix: z.string().trim().min(1).max(10),
  description: z.string().trim().max(2000).optional(),
});

export interface SettingsFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function updateSettingsAction(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const user = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };

  try {
    await updateHotelSettings(user.hotelId, user.id, { ...parsed.data, email: parsed.data.email || undefined });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Unable to save settings." };
  }

  revalidatePath("/app/settings");
  return { status: "success", message: "Settings saved." };
}
