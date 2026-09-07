"use server";

import { z } from "zod";
import { createSchoolWithOwner } from "@/lib/school-provisioning";

const registerSchema = z.object({
  schoolName: z.string().trim().min(2, "School name is required").max(200),
  ownerName: z.string().trim().min(1, "Your name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
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
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  try {
    await createSchoolWithOwner({
      schoolName: parsed.data.schoolName,
      ownerName: parsed.data.ownerName,
      ownerEmail: parsed.data.email,
      password: parsed.data.password,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create your school right now.";
    return { status: "error", message };
  }

  return { status: "success" };
}
