import "server-only";
import { auth } from "@/auth";
import type { PermissionKey } from "@/lib/permissions";
import { getUserPermissions } from "./permissions-resolve";

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}

/// Every route handler / server action for a tenant-owned resource must go
/// through this (or requirePermission) rather than reading the session
/// directly — it's the one place `schoolId` is guaranteed non-null before
/// any tenant-scoped query runs.
export async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError("Not authenticated");
  return session.user;
}

export async function requireSchoolUser() {
  const user = await requireUser();
  if (!user.schoolId) throw new ForbiddenError("This account is not attached to a school");
  return { ...user, schoolId: user.schoolId };
}

export async function requirePermission(permission: PermissionKey) {
  const user = await requireSchoolUser();
  const perms = await getUserPermissions(user.id);
  if (!perms.has(permission)) throw new ForbiddenError(`Missing permission: ${permission}`);
  return user;
}

/// The platform Super Admin is a single global user (User.schoolId null,
/// Role.schoolId null) — not a tenant role, so it's checked directly
/// against the session's role key rather than going through the
/// per-school RolePermission system requirePermission() uses.
export async function requireSuperAdmin() {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") throw new ForbiddenError("Super admin access required");
  return user;
}
