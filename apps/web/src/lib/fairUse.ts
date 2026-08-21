import { evaluateGenerationRequest, type PlanFairUsePolicy } from "@cinerra/billing";
import { prisma } from "@cinerra/database";

const ACTIVE_JOB_STATUSES = ["QUEUED", "PROCESSING", "PROVIDER_GENERATING", "DOWNLOADING", "VALIDATING", "FINALIZING", "RETRYING"] as const;

export class FairUseLimitError extends Error {}

/**
 * Resolves the caller's plan (falling back to the "free" plan if they have
 * no active subscription) and throws a friendly, credit-free error if they
 * are already at their concurrency ceiling. Called before every enqueue —
 * this is the entire enforcement mechanism behind "unlimited" (spec §43).
 */
export async function assertCanStartGeneration(userId: string): Promise<PlanFairUsePolicy> {
  const subscription = await prisma.subscription.findUnique({ where: { userId }, include: { plan: true } });
  const plan = subscription?.status === "ACTIVE" || subscription?.status === "TRIALING" ? subscription.plan : await prisma.plan.findUniqueOrThrow({ where: { key: "free" } });

  const policy: PlanFairUsePolicy = {
    planKey: plan.key,
    maxConcurrentGenerations: plan.maxConcurrentGenerations,
    queuePriority: plan.queuePriority,
    maxExportResolution: plan.maxExportResolution,
    maxStorageGB: plan.maxStorageGB,
    maxProjectDurationMinutes: plan.maxProjectDurationMinutes,
  };

  const inFlightCount = await prisma.generationJob.count({
    where: { userId, status: { in: [...ACTIVE_JOB_STATUSES] } },
  });

  const decision = evaluateGenerationRequest(policy, inFlightCount);
  if (!decision.allowed) {
    throw new FairUseLimitError(decision.reason ?? "You've reached your plan's generation limit for now.");
  }

  return policy;
}
