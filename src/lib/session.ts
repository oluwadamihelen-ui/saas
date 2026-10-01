import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { loadPlan } from "@/lib/plan";
import type { InstrumentSpec } from "@/lib/engine/risk";

export type SavedSpecs = Record<string, { spec: InstrumentSpec; confirmed: boolean }>;

export const getUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");
  return user;
});

export const getPlan = cache(loadPlan);

/**
 * Everything a signed-in page needs. The active account is ALWAYS resolved from
 * the user's own accounts, so a forged id can never select someone else's data.
 */
export const getContext = cache(async () => {
  const user = await getUser();
  if (!user.onboardedAt) redirect("/onboarding");
  const accounts = await prisma.account.findMany({
    where: { userId: user.id, archivedAt: null },
    include: { riskSettings: true },
    orderBy: { createdAt: "asc" },
  });
  if (!accounts.length) redirect("/onboarding");
  const account = accounts.find((a) => a.id === user.activeAccountId) ?? accounts[0];
  if (!account.riskSettings) notFound();
  const plan = await getPlan(user.id);
  return {
    user,
    accounts,
    account: { ...account, riskSettings: account.riskSettings, specs: (account.specs ?? {}) as unknown as SavedSpecs },
    plan,
  };
});

export type AppContext = Awaited<ReturnType<typeof getContext>>;

/** Ownership-checked account lookup for server actions. */
export async function getOwnedAccount(userId: string, accountId: string) {
  return prisma.account.findFirst({ where: { id: accountId, userId }, include: { riskSettings: true } });
}

/** Throws (404) unless the signed-in user is an admin. Never reveals that /admin exists to normal users. */
export async function requireAdmin() {
  const user = await getUser();
  if (user.role !== "ADMIN") notFound();
  return user;
}

/** The signed-in viewer, or null — never redirects (for public pages). */
export async function getViewer(): Promise<{ id: string; role: "USER" | "ADMIN"; email: string; name: string | null } | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const u = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true, email: true, name: true } });
  return u ? { id: u.id, role: u.role, email: u.email, name: u.name } : null;
}
