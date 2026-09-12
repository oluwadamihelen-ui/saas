"use server";

import { z } from "zod";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { resetUserPassword, changeUserRole, setUserStatus } from "@/lib/services/administration-users";
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

export interface ChangeRoleState {
  status: "idle" | "error" | "success";
  message?: string;
}

const changeRoleSchema = z.object({
  userId: z.string().trim().min(1),
  roleId: z.string().trim().min(1, "Choose a role"),
});

/// STAFF_MANAGE, not ROLES_MANAGE (which governs a role's own permission
/// matrix — a different concept — see PERMISSION_CATALOG) and not
/// USERS_MANAGE (view accounts + reset passwords, per its own
/// description). STAFF_MANAGE's description is literally "Edit or
/// deactivate staff accounts" — changing which role a staff account
/// holds is editing that account.
export async function changeRoleAction(_prev: ChangeRoleState, formData: FormData): Promise<ChangeRoleState> {
  const admin = await requirePermission(PERMISSIONS.STAFF_MANAGE);
  const parsed = changeRoleSchema.safeParse({ userId: formData.get("userId"), roleId: formData.get("roleId") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    await changeUserRole(admin.schoolId, admin.id, parsed.data.userId, parsed.data.roleId);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not change this user's role." };
  }

  revalidatePath("/dashboard/administration/users");
  revalidatePath("/dashboard/staff");
  return { status: "success", message: "Role updated." };
}

export async function setUserStatusAction(userId: string, status: "ACTIVE" | "SUSPENDED") {
  const admin = await requirePermission(PERMISSIONS.STAFF_MANAGE);
  await setUserStatus(admin.schoolId, admin.id, userId, status);
  revalidatePath("/dashboard/administration/users");
  revalidatePath("/dashboard/staff");
}
