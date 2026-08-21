/**
 * The enforcement mechanism behind "Unlimited AI Movie Creation" (spec
 * §5, §43, §80). There is no credit ledger anywhere in this module — a
 * plan grants a concurrency ceiling and a queue priority, not a balance
 * that depletes. A user on any paid plan can start an unbounded number of
 * generations over time; what's bounded is how many can run *at once*,
 * which is what actually controls provider spend.
 */

export type QueuePriorityLevel = "LOW" | "NORMAL" | "HIGH" | "HIGHEST";

export interface PlanFairUsePolicy {
  planKey: string;
  maxConcurrentGenerations: number;
  queuePriority: QueuePriorityLevel;
  maxExportResolution: string;
  maxStorageGB: number;
  maxProjectDurationMinutes: number;
}

export interface FairUseDecision {
  allowed: boolean;
  /** Human-readable, customer-safe — never mentions credits or provider cost. */
  reason?: string;
}

/**
 * Decides whether a new generation may start right now. Called by the API
 * route before enqueueing, and re-checked by the worker before it actually
 * dequeues work for a user, so a user can never exceed their plan's
 * concurrency ceiling by racing multiple requests.
 */
export function evaluateGenerationRequest(policy: PlanFairUsePolicy, currentInFlightCount: number): FairUseDecision {
  if (currentInFlightCount >= policy.maxConcurrentGenerations) {
    return {
      allowed: false,
      reason:
        policy.maxConcurrentGenerations === 1
          ? "You already have a generation in progress. It will start as soon as that one finishes — or upgrade your plan to run more at once."
          : `You already have ${currentInFlightCount} generations in progress, which is the limit for your plan. Wait for one to finish, or upgrade for more simultaneous generations.`,
    };
  }
  return { allowed: true };
}

/** Validates a requested export resolution against the plan's ceiling. */
export function isExportResolutionAllowed(policy: PlanFairUsePolicy, requested: "720p" | "1080p" | "4K"): boolean {
  const order = ["720p", "1080p", "4K"];
  return order.indexOf(requested) <= order.indexOf(policy.maxExportResolution);
}

/** Validates a project's target runtime against the plan's ceiling. */
export function isProjectDurationAllowed(policy: PlanFairUsePolicy, requestedMinutes: number): boolean {
  return requestedMinutes <= policy.maxProjectDurationMinutes;
}
