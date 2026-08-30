import "server-only";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TenantError } from "@/lib/errors";

export { TenantError };

export type CurrentBusinessMembership = {
  businessId: string;
  role: "OWNER" | "ADMIN" | "STAFF";
  userId: string;
};

/**
 * The single choke point for tenant isolation. Every API route and server
 * action that touches business-owned data MUST resolve the business through
 * this helper (never trust a businessId passed from the client) so a
 * merchant can never read or mutate another merchant's records.
 */
export async function requireBusinessMembership(
  businessId: string
): Promise<CurrentBusinessMembership> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new TenantError("Not authenticated", 401);
  }
  if (session.user.isSuspended) {
    throw new TenantError("Account suspended", 403);
  }

  const membership = await prisma.businessMember.findUnique({
    where: { businessId_userId: { businessId, userId: session.user.id } },
  });

  if (!membership) {
    // Deliberately identical error/shape whether the business exists or not,
    // so this endpoint can't be used to enumerate other tenants' business IDs.
    throw new TenantError("Business not found", 404);
  }

  return { businessId, role: membership.role, userId: session.user.id };
}

/** Resolves the current user's first/primary business (used for dashboard redirects). */
export async function getPrimaryBusinessId(userId: string): Promise<string | null> {
  const membership = await prisma.businessMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { businessId: true },
  });
  return membership?.businessId ?? null;
}

export function requireRole(
  membership: CurrentBusinessMembership,
  allowed: Array<"OWNER" | "ADMIN" | "STAFF">
) {
  if (!allowed.includes(membership.role)) {
    throw new TenantError("Insufficient permissions", 403);
  }
}

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new TenantError("Not authenticated", 401);
  if (session.user.globalRole !== "ADMIN" && session.user.globalRole !== "SUPER_ADMIN") {
    throw new TenantError("Admin access required", 403);
  }
  return session;
}
