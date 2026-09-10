"use server";

import { z } from "zod";
import { createHotelWithOwner } from "@/lib/services/hotels";
import { logger } from "@/lib/security/logger";

const onboardingSchema = z.object({
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
  ownerName: z.string().trim().min(1, "Your name is required").max(120),
  ownerEmail: z.string().trim().toLowerCase().email("Enter a valid email"),
  ownerPassword: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export interface RegisterState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function registerHotel(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  try {
    await createHotelWithOwner({ ...parsed.data, hotelEmail: parsed.data.hotelEmail || undefined });
  } catch (error) {
    logger.error("register.hotel_onboarding_failed", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Unable to create your hotel right now. Please try again shortly.";
    return { status: "error", message };
  }

  return { status: "success" };
}
