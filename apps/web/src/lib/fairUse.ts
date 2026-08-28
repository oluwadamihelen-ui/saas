import { evaluateGenerationRequest, type PlanFairUsePolicy } from "@cinerra/billing";
import { prisma, recordWalletTransaction } from "@cinerra/database";

const ACTIVE_JOB_STATUSES = ["QUEUED", "PROCESSING", "PROVIDER_GENERATING", "DOWNLOADING", "VALIDATING", "FINALIZING", "RETRYING"] as const;

export class FairUseLimitError extends Error {}

export class EmailNotVerifiedError extends Error {
  constructor() {
    super("Confirm your email before generating — check your inbox, or resend the link from your profile page.");
  }
}

/**
 * Paid subscribers get their included-Doe grant eagerly from the Paystack
 * webhook (subscriptions.ts), keyed to their real billing period. A user
 * with no active subscription has no such period to key off, so the
 * "free" plan's allowance is granted lazily here instead, once per
 * rolling 30-day window — the idempotencyKey makes a second call within
 * the same window a safe no-op rather than a double grant.
 */
async function ensureFreePlanDoeGrant(userId: string, plan: { id: string; name: string; includedGenerationDoe: number }): Promise<void> {
  if (plan.includedGenerationDoe <= 0) return;
  const windowKey = new Date().toISOString().slice(0, 7); // YYYY-MM — good enough granularity for a free allowance
  const idempotencyKey = `free-plan-doe:${userId}:${windowKey}`;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma
    .$transaction(async (tx) => {
      const grant = await tx.promotionalGrant.create({
        data: {
          userId,
          coins: plan.includedGenerationDoe,
          remainingCoins: plan.includedGenerationDoe,
          reason: `Included with your ${plan.name} plan`,
          expiresAt,
        },
      });
      await recordWalletTransaction(tx, {
        userId,
        type: "PROMOTIONAL_CREDIT",
        amount: plan.includedGenerationDoe,
        referenceType: "PromotionalGrant",
        referenceId: grant.id,
        idempotencyKey,
      });
    })
    .catch(() => undefined); // already granted this window — expected on every call after the first
}

/**
 * Resolves the caller's plan (falling back to the "free" plan if they have
 * no active subscription) and throws a friendly error if they are already
 * at their concurrency ceiling. Called before every enqueue. This bounds
 * how many generations run *at once*; what bounds total spend over time is
 * the Doe balance itself (chargeForGeneration, checked when the worker
 * actually starts the paid provider call) — the two limits work together.
 */
export async function assertCanStartGeneration(userId: string): Promise<PlanFairUsePolicy> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { emailVerifiedAt: true } });
  if (!user.emailVerifiedAt) throw new EmailNotVerifiedError();

  const subscription = await prisma.subscription.findUnique({ where: { userId }, include: { plan: true } });
  const hasActiveSubscription = subscription?.status === "ACTIVE" || subscription?.status === "TRIALING";
  const plan = hasActiveSubscription ? subscription.plan : await prisma.plan.findUniqueOrThrow({ where: { key: "free" } });
  if (!hasActiveSubscription) await ensureFreePlanDoeGrant(userId, plan);

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
