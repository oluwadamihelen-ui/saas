import "server-only";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { PERMISSIONS, PERMISSION_CATALOG, type PermissionKey } from "@/lib/permissions";

const ALL_PERMISSION_KEYS = new Set<string>(PERMISSION_CATALOG.map((p) => p.key));

export interface RoleWithPermissions {
  id: string;
  key: string;
  name: string;
  isLocked: boolean;
  permissionKeys: string[];
}

/// Every role belonging to this school, each with its current permission
/// set — the data behind the role → permission matrix editor. SCHOOL_OWNER
/// is included but flagged isLocked: it always holds every permission
/// (ROLE_DEFAULT_PERMISSIONS' ALL_PERMISSIONS) and the UI/action both
/// refuse to change that, so a school can never edit itself into having no
/// one left who can undo a mistake.
export async function listRolesForSchool(schoolId: string): Promise<RoleWithPermissions[]> {
  const roles = await prisma.role.findMany({
    where: { schoolId },
    include: { rolePermissions: { include: { permission: true } } },
    orderBy: { createdAt: "asc" },
  });

  return roles.map((role) => ({
    id: role.id,
    key: role.key,
    name: role.name,
    isLocked: role.key === "SCHOOL_OWNER",
    permissionKeys: role.rolePermissions.map((rp) => rp.permission.key).sort(),
  }));
}

export class RolePermissionUpdateError extends Error {}

/// Applies a school's own decision about what a role can do — the acting
/// user is already known to hold ROLES_MANAGE (checked by the caller via
/// requirePermission), but two extra guardrails live here, not in the UI,
/// so they hold even against a hand-crafted request:
///
/// 1. SCHOOL_OWNER's permission set can never be edited — it must always
///    be able to undo any other role's misconfiguration.
/// 2. You can never remove ROLES_MANAGE from the role you yourself
///    currently hold — otherwise a Head of School editing their own role
///    could accidentally lock themselves out of this very page (the
///    School Owner would still have it, but that's a support ticket this
///    check avoids entirely).
export async function updateRolePermissions(
  schoolId: string,
  actingUserId: string,
  actingRoleId: string,
  targetRoleId: string,
  desiredPermissionKeys: PermissionKey[]
): Promise<void> {
  const role = await prisma.role.findFirst({
    where: { id: targetRoleId, schoolId },
    include: { rolePermissions: { include: { permission: true } } },
  });
  if (!role) throw new RolePermissionUpdateError("Role not found.");
  if (role.key === "SCHOOL_OWNER") {
    throw new RolePermissionUpdateError("The School Owner role always has full access and can't be changed.");
  }

  const desired = new Set<string>(desiredPermissionKeys.filter((key) => ALL_PERMISSION_KEYS.has(key)));

  if (targetRoleId === actingRoleId && !desired.has(PERMISSIONS.ROLES_MANAGE)) {
    throw new RolePermissionUpdateError("You can't remove your own ability to manage roles.");
  }

  const permissions = await prisma.permission.findMany({ where: { key: { in: [...desired] } } });
  const permissionIdByKey = new Map(permissions.map((p) => [p.key, p.id]));

  const current = new Map(role.rolePermissions.map((rp) => [rp.permission.key, rp.permissionId]));
  const previousKeys = [...current.keys()].sort();

  const toGrant = [...desired].filter((key) => !current.has(key));
  const toRevoke = [...current.keys()].filter((key) => !desired.has(key));

  await prisma.$transaction(async (tx) => {
    if (toGrant.length > 0) {
      await tx.rolePermission.createMany({
        data: toGrant.map((key) => ({ roleId: role.id, permissionId: permissionIdByKey.get(key)! })),
        skipDuplicates: true,
      });
    }
    if (toRevoke.length > 0) {
      await tx.rolePermission.deleteMany({
        where: { roleId: role.id, permissionId: { in: toRevoke.map((key) => current.get(key)!) } },
      });
    }
  });

  if (toGrant.length > 0 || toRevoke.length > 0) {
    await logAudit({
      schoolId,
      userId: actingUserId,
      action: "roles.permissions_changed",
      resourceType: "Role",
      resourceId: role.id,
      previousValue: { roleKey: role.key, permissions: previousKeys },
      newValue: { roleKey: role.key, permissions: [...desired].sort() },
    });
  }
}
