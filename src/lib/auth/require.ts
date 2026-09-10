import { auth } from "@/auth";
import { PermissionKey } from "./permissions";
import { getUserPermissions } from "./permissions-resolve";

export { getUserPermissions };

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}

export async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError("Not authenticated");
  return session.user;
}

export async function requireSuperAdmin() {
  const user = await requireUser();
  if (!user.isSuperAdmin) throw new ForbiddenError("Super Admin access required");
  return user;
}

/**
 * The primary hotel-isolation boundary: every hotel-scoped server action or
 * service call goes through this first. It returns the caller's hotelId
 * resolved SERVER-SIDE from their session -- never from a client-supplied
 * argument -- so there is no code path where a request can name a different
 * hotel's id and read/write its data.
 */
export async function requireHotelUser() {
  const user = await requireUser();
  if (!user.hotelId) throw new ForbiddenError("No active hotel selected");
  return user as typeof user & { hotelId: string };
}

export async function requireRole(...roles: string[]) {
  const user = await requireUser();
  if (user.isSuperAdmin && roles.includes("SUPER_ADMIN")) return user;
  if (!roles.includes(user.role)) throw new ForbiddenError("Insufficient role");
  return user;
}

export async function requirePermission(permission: PermissionKey) {
  const user = await requireHotelUser();
  if (user.role === "HOTEL_OWNER") return user;
  const perms = await getUserPermissions(user.id, user.hotelId);
  if (!perms.has(permission)) throw new ForbiddenError(`Missing permission: ${permission}`);
  return user;
}
