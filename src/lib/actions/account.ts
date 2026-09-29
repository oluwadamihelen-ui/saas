"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth/require";
import { changePassword, updateOwnProfile } from "@/lib/services/account";

export interface AccountFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(200),
});

export async function changePasswordAction(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };

  try {
    await changePassword(user.id, parsed.data.currentPassword, parsed.data.newPassword);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Unable to update password." };
  }

  return { status: "success", message: "Password updated." };
}

const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  phone: z.string().trim().max(40).optional(),
});

export async function updateProfileAction(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };

  await updateOwnProfile(user.id, parsed.data);
  return { status: "success", message: "Profile updated." };
}
