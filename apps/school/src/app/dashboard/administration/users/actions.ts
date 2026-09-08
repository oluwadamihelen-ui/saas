"use server";

import { z } from "zod";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { resetUserPassword } from "@/lib/services/administration-users";
import { logAudit } from "@/lib/audit";

export interface ResetPasswordState {
  status: "idle" | "error" | "success";
  message?: string;
}

const schema = z.object({
  userId: z.string().trim().min(1, "Choose a user"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function resetPasswordAction(_prev: ResetPasswordState, formData: FormData): Promise<ResetPasswordState> {
  const admin = await requirePermission(PERMISSIONS.USERS_MANAGE);
  const parsed = schema.safeParse({ userId: formData.get("userId"), password: formData.get("password") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    await resetUserPassword(admin.schoolId, parsed.data.userId, parsed.data.password);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not reset this password." };
  }

  await logAudit({ schoolId: admin.schoolId, userId: admin.id, action: "administration.password_reset", resourceType: "User", resourceId: parsed.data.userId });
  return { status: "success", message: "Password reset." };
}
