import { prisma } from "@/lib/db";

/**
 * Resolves effective permissions for a user: role defaults + per-user
 * overrides (UserPermission), so a SUPER_ADMIN can grant/revoke individual
 * capabilities for a STAFF account without touching code.
 *
 * Deliberately has no dependency on next-auth (unlike require.ts) so it can
 * be imported from plain Node contexts -- tests, scripts -- without pulling
 * in the Next.js-only auth config.
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
