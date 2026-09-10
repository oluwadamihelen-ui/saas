import "server-only";
import { forbidden, unauthorized } from "next/navigation";
import { auth } from "@/auth";
import type { PermissionKey } from "@/lib/permissions";
import { getUserPermissions } from "./permissions-resolve";

/// Every route handler / server action for a tenant-owned resource must go
/// through this (or requirePermission) rather than reading the session
/// directly — it's the one place `schoolId` is guaranteed non-null before
/// any tenant-scoped query runs.
///
/// A missing session here is normally unreachable in the browser (the
/// middleware matcher on /dashboard, /portal, /platform and /onboarding
/// already redirects to /login before any page renders) — this is
/// defense-in-depth for anything outside that matcher, or a session that
/// expires mid-request. unauthorized()/forbidden() (next/navigation) render
/// src/app/unauthorized.tsx / forbidden.tsx instead of throwing a plain
/// Error, which Next has no default boundary for.
export async function requireUser() {
  const session = await auth();
  if (!session?.user) unauthorized();
  return session.user;
}

export async function requireSchoolUser() {
  const user = await requireUser();
  if (!user.schoolId) forbidden();
  return { ...user, schoolId: user.schoolId };
}

export async function requirePermission(permission: PermissionKey) {
  const user = await requireSchoolUser();
  const perms = await getUserPermissions(user.id);
  if (!perms.has(permission)) forbidden();
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
  if (!permissions.some((p) => perms.has(p))) forbidden();
  return { ...user, perms };
}

/// The platform Super Admin is a single global user (User.schoolId null,
/// Role.schoolId null) — not a tenant role, so it's checked directly
/// against the session's role key rather than going through the
/// per-school RolePermission system requirePermission() uses.
export async function requireSuperAdmin() {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") forbidden();
  return user;
}
