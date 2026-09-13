"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS, PERMISSION_CATALOG, type PermissionKey } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { updateRolePermissions, RolePermissionUpdateError } from "@/lib/services/role-permissions";

const VALID_KEYS = PERMISSION_CATALOG.map((p) => p.key) as [string, ...string[]];

const schema = z.object({
  roleId: z.string().trim().min(1, "Choose a role"),
  permissionKeys: z.array(z.enum(VALID_KEYS)),
});

export interface RolePermissionsState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function saveRolePermissions(_prev: RolePermissionsState, formData: FormData): Promise<RolePermissionsState> {
  const user = await requirePermission(PERMISSIONS.ROLES_MANAGE);

  const parsed = schema.safeParse({
    roleId: formData.get("roleId"),
    permissionKeys: formData.getAll("permissionKeys"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the selected permissions." };
  }

  // Session only carries the role KEY (e.g. "TEACHER"), not its row id —
  // resolve it here rather than trusting anything client-supplied, since
  // (schoolId, key) uniquely and safely identifies the acting user's own role.
  const actingRole = await prisma.role.findFirst({ where: { schoolId: user.schoolId, key: user.role } });
  if (!actingRole) {
    return { status: "error", message: "Could not resolve your own role." };
  }

  try {
    await updateRolePermissions(
      user.schoolId,
      user.id,
      actingRole.id,
      parsed.data.roleId,
      parsed.data.permissionKeys as PermissionKey[]
    );
  } catch (error) {
    const message = error instanceof RolePermissionUpdateError ? error.message : "Could not update this role's permissions.";
    return { status: "error", message };
  }

  revalidatePath("/dashboard/administration/roles");
  return { status: "success", message: "Saved." };
}
