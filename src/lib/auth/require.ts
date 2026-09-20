import "server-only";
import { auth } from "@/auth";
import { PERMISSION_CATALOG, type PermissionKey } from "@/lib/permissions";
import { getUserPermissions } from "./permissions-resolve";

/// Both carry a message that's already safe and specific enough to show
/// directly to the end user (see permissionDeniedMessage below) — nothing
/// downstream needs to reword these, only catch them. See withAuthErrors
/// at the bottom of this file for the one place that actually does.
export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}

const PERMISSION_DESCRIPTIONS = new Map(PERMISSION_CATALOG.map((p) => [p.key, p.description]));

/// Turns a permission key like "school.settings_manage" into the same
/// human sentence Role Management already shows for it ("Edit school
/// profile and branding"), so a denied user sees exactly what their role
/// is missing instead of a raw permission key — and exactly what to ask
/// their school owner/admin for.
function permissionDeniedMessage(permission: PermissionKey): string {
  const description = PERMISSION_DESCRIPTIONS.get(permission);
  if (!description) return "You don't have permission to perform this action.";
  const lowered = description.charAt(0).toLowerCase() + description.slice(1);
  return `You don't have permission to ${lowered}. Ask your school owner or administrator to grant you access.`;
}

/// Every route handler / server action for a tenant-owned resource must go
/// through this (or requirePermission) rather than reading the session
/// directly — it's the one place `schoolId` is guaranteed non-null before
/// any tenant-scoped query runs.
export async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError("Your session has expired — please sign in again.");
  return session.user;
}

export async function requireSchoolUser() {
  const user = await requireUser();
  if (!user.schoolId) throw new ForbiddenError("This account isn't attached to a school, so it can't access this.");
  return { ...user, schoolId: user.schoolId };
}

export async function requirePermission(permission: PermissionKey) {
  const user = await requireSchoolUser();
  const perms = await getUserPermissions(user.id);
  if (!perms.has(permission)) throw new ForbiddenError(permissionDeniedMessage(permission));
  return user;
}

/// For a page/action reachable by more than one permission (e.g. a page
/// that shows a full admin view to ACADEMICS_MANAGE holders and a smaller
/// self-service view to SUBJECTS_CREATE holders) — passes as soon as the
/// user holds any one of the listed permissions. Returns the resolved
/// permission set alongside the user so the caller can branch on exactly
/// which one(s) they actually have, without a second DB round trip.
export async function requireAnyPermission(permissions: PermissionKey[]) {
  const user = await requireSchoolUser();
  const perms = await getUserPermissions(user.id);
  if (!permissions.some((p) => perms.has(p))) {
    throw new ForbiddenError(permissionDeniedMessage(permissions[0]));
  }
  return { ...user, perms };
}

/// The platform Super Admin is a single global user (User.schoolId null,
/// Role.schoolId null) — not a tenant role, so it's checked directly
/// against the session's role key rather than going through the
/// per-school RolePermission system requirePermission() uses.
export async function requireSuperAdmin() {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") throw new ForbiddenError("This area is restricted to Schoolum's platform administrators.");
  return user;
}

/// The Partner Program's global (School = null) role — checked directly
/// against the session's role key, mirroring requireSuperAdmin(). A
/// Partner never gains school-tenant permissions.
export async function requirePartner() {
  const user = await requireUser();
  if (user.role !== "PARTNER") throw new ForbiddenError("This area is only available to Schoolum Partner accounts.");
  return user;
}

/// The Buyer Program's global (School = null) role — checked directly
/// against the session's role key, mirroring requireSuperAdmin()/
/// requirePartner(). A Buyer never gains school-tenant permissions.
export async function requireBuyer() {
  const user = await requireUser();
  if (user.role !== "BUYER") throw new ForbiddenError("This area is only available to Schoolum Buyer accounts.");
  return user;
}

/// Wraps a Server Action so an UnauthorizedError/ForbiddenError thrown by
/// any requireX() call inside it — none of which are ever caught
/// otherwise — becomes the same {status:"error", message} shape every
/// action already returns for its own business-logic failures, instead of
/// escaping uncaught into Next's generic "something went wrong" screen.
/// Anything else thrown is left to propagate as-is: most actions already
/// have their own try/catch around business logic for errors they expect,
/// and a real bug should never get quietly relabelled as if the user just
/// lacked permission.
export function withAuthErrors<Args extends unknown[], State extends { status: string; message?: string }>(
  action: (...args: Args) => Promise<State>
): (...args: Args) => Promise<State> {
  return async (...args: Args) => {
    try {
      return await action(...args);
    } catch (error) {
      if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
        return { status: "error", message: error.message } as State;
      }
      throw error;
    }
  };
}
