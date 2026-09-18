"use server";

import { z } from "zod";
import { applyAsPartner } from "@/lib/services/partner-onboarding";

const applySchema = z
  .object({
    displayName: z.string().trim().min(2, "Your name is required").max(120),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    phone: z.string().trim().max(30).optional().or(z.literal("")),
    password: z.string().min(8, "Password must be at least 8 characters").max(200),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export interface PartnerApplyState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function applyAsPartnerAction(_prev: PartnerApplyState, formData: FormData): Promise<PartnerApplyState> {
  const parsed = applySchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  try {
    await applyAsPartner({
      displayName: parsed.data.displayName,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      password: parsed.data.password,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to submit your application right now.";
    return { status: "error", message };
  }

  return { status: "success" };
}
