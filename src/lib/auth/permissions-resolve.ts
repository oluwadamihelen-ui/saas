import { prisma } from "@/lib/db";

/**
 * Resolves a user's effective permissions straight from the database on
 * every call (no caching across requests) so a permission change on their
 * role takes effect immediately rather than waiting for their session token
 * to expire.
 */
export async function getUserPermissions(userId: string): Promise<Set<string>> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
  });
  if (!user) return new Set();
  return new Set(user.role.rolePermissions.map((rp) => rp.permission.key));
}
