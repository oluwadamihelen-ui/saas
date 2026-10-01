import "server-only";
import { prisma } from "@/lib/db";
import { PLAN_LIMITS, type PlanKey, type PlanLimits } from "@/config/plans";

export async function loadPlan(userId: string): Promise<{ key: PlanKey; limits: PlanLimits; renewsAt: Date | null }> {
  const sub = await prisma.subscription.findFirst({
    where: { userId, status: "ACTIVE", currentPeriodEnd: { gt: new Date() } },
    orderBy: { currentPeriodEnd: "desc" },
  });
  const key: PlanKey = sub ? "PRO" : "FREE";
  return { key, limits: PLAN_LIMITS[key], renewsAt: sub?.currentPeriodEnd ?? null };
}
