import "server-only";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { PERMISSION_CATALOG, type PermissionKey } from "@/lib/permissions";

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
/// 2. No one can change the permission set of the role they themselves
///    currently hold, at all — not just narrowly protecting ROLES_MANAGE
///    from removal. Letting a Head of School grant themselves a new
///    permission (e.g. billing.manage) is self-escalation with no one
///    else's sign-off, the same class of problem as approving your own
///    expense claim; only a DIFFERENT role's holder (ultimately always
///    SCHOOL_OWNER, since it's the only other role with ROLES_MANAGE) can
///    change what your role can do. SCHOOL_OWNER never hits this case in
///    practice — its own role is already blocked by guardrail 1 above —
///    but the check is written generally in case a school ever grants
///    ROLES_MANAGE to a third role.
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
  if (targetRoleId === actingRoleId) {
    throw new RolePermissionUpdateError("You can't change the permissions of your own role — ask another role holder with Manage Roles access to do it.");
  }

  const desired = new Set<string>(desiredPermissionKeys.filter((key) => ALL_PERMISSION_KEYS.has(key)));

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
