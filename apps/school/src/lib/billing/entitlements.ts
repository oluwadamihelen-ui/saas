import "server-only";
import { prisma } from "@/lib/db";
import { GRACE_PERIOD_DAYS } from "./config";
import { notifyTrialExpired, notifySubscriptionPaymentFailed, notifyStudentLimitReachedOnce } from "@/lib/services/notifications";
import type { FeatureKey } from "./features";
import type { Subscription, SubscriptionPlan, SubscriptionStatus } from "@/generated/prisma/client";

export class EntitlementError extends Error {
  constructor(
    message: string,
    public feature: FeatureKey
  ) {
    super(message);
  }
}

export class StudentLimitError extends Error {
  constructor(public limit: number) {
    super(`Your plan supports up to ${limit} students. Upgrade your plan to add more students.`);
  }
}

type SubscriptionWithPlan = Subscription & { plan: SubscriptionPlan };

export interface EffectiveSubscription {
  subscription: SubscriptionWithPlan;
  /// The status AFTER lazy reconciliation — may differ from the row's own
  /// `status` if this call is the first read to notice an expiry. This app
  /// has no background job runner, so status transitions that would
  /// normally fire on a schedule (trial ending, period lapsing, grace
  /// period elapsing) are instead applied — and persisted — the next time
  /// anything asks "is this school entitled" (see reconcile() below).
  effectiveStatus: SubscriptionStatus;
  isTrialing: boolean;
  trialDaysRemaining: number | null;
}

/// Lazy status reconciliation, persisted so it only needs to happen once
/// per actual transition, not on every read:
///  - TRIALING past trialEnd -> EXPIRED
///  - ACTIVE past currentPeriodEnd (no renewal recorded) -> PAST_DUE,
///    starting a GRACE_PERIOD_DAYS grace window (spec section 27)
///  - PAST_DUE past graceEndsAt with no successful retry -> EXPIRED
/// Never touches CANCELED or SUSPENDED — those are terminal/admin-set and
/// this function only ever moves a subscription *toward* restricted
/// access due to time passing, never reverses an admin's own decision.
async function reconcile(subscription: SubscriptionWithPlan): Promise<SubscriptionWithPlan> {
  const now = new Date();
  let data: { status: SubscriptionStatus; pastDueSince?: Date; graceEndsAt?: Date } | null = null;

  if (subscription.status === "TRIALING" && subscription.trialEnd && subscription.trialEnd < now) {
    data = { status: "EXPIRED" };
  } else if (subscription.status === "ACTIVE" && subscription.currentPeriodEnd < now) {
    const graceEndsAt = new Date(subscription.currentPeriodEnd);
    graceEndsAt.setDate(graceEndsAt.getDate() + GRACE_PERIOD_DAYS);
    data = { status: "PAST_DUE", pastDueSince: subscription.currentPeriodEnd, graceEndsAt };
  } else if (subscription.status === "PAST_DUE" && subscription.graceEndsAt && subscription.graceEndsAt < now) {
    data = { status: "EXPIRED" };
  }

  if (!data) return subscription;
  const updated = await prisma.subscription.update({ where: { id: subscription.id }, data, include: { plan: true } });

  // Fired exactly once per transition — the branch above only matches the
  // OLD status, so once it flips this same check no longer applies on the
  // next read (no separate idempotency tracking needed).
  if (data.status === "EXPIRED" && subscription.status === "TRIALING") {
    await notifyTrialExpired(subscription.schoolId);
  } else if (data.status === "PAST_DUE") {
    await notifySubscriptionPaymentFailed(subscription.schoolId, subscription.plan.name);
  }

  return updated;
}

export async function getEffectiveSubscription(schoolId: string): Promise<EffectiveSubscription | null> {
  const subscription = await prisma.subscription.findUnique({ where: { schoolId }, include: { plan: true } });
  if (!subscription) return null;

  const reconciled = await reconcile(subscription);
  const isTrialing = reconciled.status === "TRIALING";
  const trialDaysRemaining =
    isTrialing && reconciled.trialEnd ? Math.max(0, Math.ceil((reconciled.trialEnd.getTime() - Date.now()) / 86_400_000)) : null;

  return { subscription: reconciled, effectiveStatus: reconciled.status, isTrialing, trialDaysRemaining };
}

/// Which statuses still grant feature access at all. PAST_DUE is
/// deliberately included — that's the whole point of a grace period
/// (spec section 27): a failed renewal charge doesn't instantly cut a
/// school off. EXPIRED, CANCELED and SUSPENDED are not — access, not
/// data, is what a lapsed subscription loses.
const ENTITLED_STATUSES: SubscriptionStatus[] = ["TRIALING", "ACTIVE", "PAST_DUE"];

/// The backend source of truth for "can this school use this feature
/// right now" (spec section 8) — checks plan, status (via the lazy
/// reconciliation above) and the plan's own feature map in one place, so
/// nothing else in the app re-implements this logic. No subscription row
/// at all reads as "no premium features" (fails closed) rather than
/// throwing, since a school predating the subscription system (see
/// ARCHITECTURE.md) should degrade gracefully, not error.
export async function hasFeature(schoolId: string, feature: FeatureKey): Promise<boolean> {
  const effective = await getEffectiveSubscription(schoolId);
  if (!effective || !ENTITLED_STATUSES.includes(effective.effectiveStatus)) return false;

  const features = effective.subscription.plan.features as Record<string, boolean>;
  return Boolean(features[feature]);
}

export const canAccessFeature = hasFeature;

/// The server-side gate every premium page/action/AI tool must call
/// before doing anything a lower plan shouldn't be able to trigger — the
/// frontend hiding a button is UX, never security (spec section 30).
export async function requireFeature(schoolId: string, feature: FeatureKey): Promise<void> {
  if (!(await hasFeature(schoolId, feature))) {
    throw new EntitlementError(`This feature isn't included in your current plan.`, feature);
  }
}

/// Deliberately permissive when there's no subscription row at all
/// (unlike hasFeature) — a school that predates the subscription system,
/// or is in some other broken provisioning state, should not suddenly be
/// unable to enroll a student it could enroll yesterday. A missing
/// Subscription is an operational gap to fix, not a reason to block
/// enrollment; an EXPIRED/CANCELED one, by contrast, is a real decision
/// this function does enforce (studentLimit still resolves to the plan's
/// number even for a lapsed subscription, since the *feature* of
/// enrolling students isn't gated by status the way premium modules are —
/// only the ceiling itself is plan-specific).
export async function getStudentLimit(schoolId: string): Promise<number | null> {
  const subscription = await prisma.subscription.findUnique({ where: { schoolId }, include: { plan: true } });
  if (!subscription) return null;
  return subscription.plan.studentLimit;
}

/// Active-student counting rule (spec section 10): only ACTIVE students
/// count against a plan's limit. GRADUATED and WITHDRAWN students have
/// left the school (a historical record, not a seat in use); SUSPENDED
/// students are still enrolled — a disciplinary hold, not a departure —
/// so counting them would let a school dodge its limit by suspending
/// students it has no intention of removing. This is the one place that
/// rule is decided; nothing else recomputes it independently.
export async function getActiveStudentCount(schoolId: string): Promise<number> {
  return prisma.student.count({ where: { schoolId, status: { in: ["ACTIVE", "SUSPENDED"] } } });
}

export interface StudentUsage {
  count: number;
  limit: number | null;
  percentUsed: number | null;
}

export async function getStudentUsage(schoolId: string): Promise<StudentUsage> {
  const [count, limit] = await Promise.all([getActiveStudentCount(schoolId), getStudentLimit(schoolId)]);
  return { count, limit, percentUsed: limit ? Math.round((count / limit) * 1000) / 10 : null };
}

/// The one server-side choke point every student-creating path goes
/// through (direct enrollment in students.ts, and admission's
/// admitApplicant which itself calls createStudent) — never trust a
/// frontend check alone (spec section 30).
export async function requireStudentCapacity(schoolId: string): Promise<void> {
  const limit = await getStudentLimit(schoolId);
  if (limit === null) return;
  const count = await getActiveStudentCount(schoolId);
  if (count >= limit) {
    await notifyStudentLimitReachedOnce(schoolId, limit);
    throw new StudentLimitError(limit);
  }
}
