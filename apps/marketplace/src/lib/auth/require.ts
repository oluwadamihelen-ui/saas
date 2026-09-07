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

export async function requireRole(...roles: string[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new ForbiddenError("Insufficient role");
  return user;
}

export async function requirePermission(permission: PermissionKey) {
  const user = await requireUser();
  if (user.role === "SUPER_ADMIN") return user;
  const perms = await getUserPermissions(user.id);
  if (!perms.has(permission)) throw new ForbiddenError(`Missing permission: ${permission}`);
  return user;
}
