import { prisma } from "@/lib/db";
import { PERMISSION_CATALOG, ROLE_DEFAULT_PERMISSIONS, type PermissionKey } from "./permissions";
import type { RoleKey } from "@/generated/prisma/enums";

/**
 * Resolves effective permissions for a user AT ONE HOTEL: role defaults for
 * their HotelMember.role at that hotel, plus per-user/per-hotel overrides
 * (UserPermission). Deliberately has no dependency on next-auth (unlike
 * require.ts) so it can be imported from plain Node contexts -- tests,
 * scripts -- without pulling in the Next.js-only auth config.
 */
export async function getUserPermissions(userId: string, hotelId: string | null): Promise<Set<string>> {
  if (!hotelId) return new Set();

  const membership = await prisma.hotelMember.findUnique({
    where: { hotelId_userId: { hotelId, userId } },
  });
  if (!membership) return new Set();

  const roleKey = membership.role as Exclude<RoleKey, "SUPER_ADMIN">;
  const defaults = ROLE_DEFAULT_PERMISSIONS[roleKey] ?? [];
  const perms = new Set<string>(defaults);

  const overrides = await prisma.userPermission.findMany({
    where: { userId, hotelId },
    include: { permission: true },
  });
  for (const override of overrides) {
    if (override.granted) perms.add(override.permission.key);
    else perms.delete(override.permission.key);
  }
  return perms;
}

export function isValidPermissionKey(key: string): key is PermissionKey {
  return PERMISSION_CATALOG.some((p) => p.key === key);
}
