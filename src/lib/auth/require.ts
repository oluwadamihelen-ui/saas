import "server-only";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PermissionKey } from "./permissions";

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}

export async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError("Not authenticated");
  return session.user;
}

export async function requireRole(...roles: string[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new ForbiddenError("Insufficient role");
  return user;
}

/**
 * Resolves effective permissions for a user: role defaults + per-user
 * overrides (UserPermission), so a SUPER_ADMIN can grant/revoke individual
 * capabilities for a STAFF account without touching code.
 */
export async function getUserPermissions(userId: string): Promise<Set<string>> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
      permissionOverrides: { include: { permission: true } },
    },
  });
  if (!user) return new Set();

  const perms = new Set(user.role.permissions.map((rp) => rp.permission.key));
  for (const override of user.permissionOverrides) {
    if (override.granted) perms.add(override.permission.key);
    else perms.delete(override.permission.key);
  }
  return perms;
}

export async function requirePermission(permission: PermissionKey) {
  const user = await requireUser();
  if (user.role === "SUPER_ADMIN") return user;
  const perms = await getUserPermissions(user.id);
  if (!perms.has(permission)) throw new ForbiddenError(`Missing permission: ${permission}`);
  return user;
}
