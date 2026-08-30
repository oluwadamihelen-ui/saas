import "server-only";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const ACTIVE_BUSINESS_COOKIE = "mama_active_business";

/**
 * Resolves the signed-in user's active business for server components.
 * Only ever returns a business the user is actually a member of — the
 * cookie is just a preference, never trusted as an access grant on its own.
 */
export async function getCurrentBusiness() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const memberships = await prisma.businessMember.findMany({
    where: { userId: session.user.id },
    include: { business: true },
    orderBy: { createdAt: "asc" },
  });
  if (memberships.length === 0) return null;

  const cookieStore = await cookies();
  const preferredId = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value;
  const preferred = memberships.find((m) => m.businessId === preferredId);
  const active = preferred ?? memberships[0];

  return {
    business: active.business,
    role: active.role,
    allBusinesses: memberships.map((m) => ({ ...m.business, role: m.role })),
    session,
  };
}
