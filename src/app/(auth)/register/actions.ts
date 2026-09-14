"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { createSchoolWithOwner } from "@/lib/school-provisioning";
import { getPendingPartnerReferralFromCookie, PARTNER_REFERRAL_COOKIE_NAME } from "@/lib/services/partner-referrals";

const registerSchema = z
  .object({
    schoolName: z.string().trim().min(2, "School name is required").max(200),
    ownerName: z.string().trim().min(1, "Your name is required").max(120),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters").max(200),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export interface RegisterState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function registerSchool(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    schoolName: formData.get("schoolName"),
    ownerName: formData.get("ownerName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const partnerReferral = await getPendingPartnerReferralFromCookie();

  try {
    await createSchoolWithOwner({
      schoolName: parsed.data.schoolName,
      ownerName: parsed.data.ownerName,
      ownerEmail: parsed.data.email,
      password: parsed.data.password,
      partnerReferral,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create your school right now.";
    return { status: "error", message };
  }

  if (partnerReferral) {
    (await cookies()).delete(PARTNER_REFERRAL_COOKIE_NAME);
  }

  return { status: "success" };
}
