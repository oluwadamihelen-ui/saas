import "server-only";
import { prisma } from "@/lib/db";
import { getEffectiveSubscription, getStudentUsage } from "@/lib/billing/entitlements";
import { planPriceForInterval } from "@/lib/services/platform";
import { notifyPlanChanged, notifySubscriptionCancelled, notifySubscriptionRenewed } from "@/lib/services/notifications";
import type { BillingInterval } from "@/generated/prisma/client";

/// The school's own read-only view of its platform subscription — distinct
/// from src/lib/services/platform.ts, which is Super-Admin-scoped and can
/// see/change every school's billing.
export async function getSchoolBilling(schoolId: string) {
  const [effective, invoices, usage] = await Promise.all([
    getEffectiveSubscription(schoolId),
    prisma.platformInvoice.findMany({ where: { schoolId }, orderBy: { periodStart: "desc" } }),
    getStudentUsage(schoolId),
  ]);
  if (!effective) return null;
  return { ...effective, invoices, usage };
}

export class DowngradeBlockedError extends Error {
  constructor(
    public currentCount: number,
    public limit: number,
    public planName: string
  ) {
    super(`Your school currently has ${currentCount} active students. ${planName} supports ${limit}.`);
  }
}

/// A school upgrading or downgrading itself (spec sections 11-12). Applies
/// the plan/interval change immediately in both directions — no
/// proration, and a downgrade is never deferred to period-end; this is a
/// deliberate simplification for a first version of self-serve plan
/// changes, not a shortcut that loses anything: data is never touched
/// either way, only Subscription.planId/billingInterval. A downgrade that
/// would drop the school under its current active-student count is
/// refused outright (DowngradeBlockedError) rather than silently
/// archiving or deleting anyone — the school must resolve that first.
export async function changePlanSelfServe(schoolId: string, newPlanId: string, billingInterval: BillingInterval) {
  const [subscription, newPlan] = await Promise.all([
    prisma.subscription.findUnique({ where: { schoolId }, include: { plan: true } }),
    prisma.subscriptionPlan.findUnique({ where: { id: newPlanId } }),
  ]);
  if (!subscription) throw new Error("This school has no subscription to change.");
  if (!newPlan || !newPlan.isActive) throw new Error("This plan is not available.");

  if (newPlan.studentLimit !== null) {
    const activeCount = await prisma.student.count({ where: { schoolId, status: { in: ["ACTIVE", "SUSPENDED"] } } });
    if (activeCount > newPlan.studentLimit) {
      throw new DowngradeBlockedError(activeCount, newPlan.studentLimit, newPlan.name);
    }
  }

  const isUpgrade = newPlan.sortOrder > subscription.plan.sortOrder;
  const wasTrialing = subscription.status === "TRIALING";

  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  if (billingInterval === "YEARLY") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else periodEnd.setMonth(periodEnd.getMonth() + 1);

  const updated = await prisma.subscription.update({
    where: { schoolId },
    data: {
      planId: newPlan.id,
      billingInterval,
      // Converting out of a trial starts a real billing period now; an
      // already-paying school keeps its ACTIVE status and current period
      // as-is (no proration in this version — the new plan/price applies
      // at the next renewal invoice, generated below for visibility).
      status: wasTrialing ? "ACTIVE" : subscription.status,
      trialEnd: wasTrialing ? new Date() : subscription.trialEnd,
      currentPeriodStart: wasTrialing ? periodStart : subscription.currentPeriodStart,
      currentPeriodEnd: wasTrialing ? periodEnd : subscription.currentPeriodEnd,
    },
    include: { plan: true },
  });

  // Any still-outstanding invoice from before this change no longer
  // reflects what's owed (it was billed at the old plan's price) — void it
  // rather than leave two PENDING invoices for the same account. A PAID
  // invoice is history and is never touched.
  await prisma.platformInvoice.updateMany({
    where: { schoolId, subscriptionId: updated.id, status: "PENDING" },
    data: { status: "VOID" },
  });

  const amountMinor = planPriceForInterval(newPlan, billingInterval);
  if (amountMinor !== null) {
    await prisma.platformInvoice.create({
      data: {
        schoolId,
        subscriptionId: updated.id,
        periodStart: updated.currentPeriodStart,
        periodEnd: updated.currentPeriodEnd,
        amountMinor,
        currency: newPlan.currency,
        billingInterval,
        dueDate: updated.currentPeriodEnd,
      },
    });
  }

  await notifyPlanChanged(schoolId, newPlan.name, isUpgrade ? "PLAN_UPGRADED" : "PLAN_DOWNGRADED");
  return updated;
}

export async function cancelSubscriptionSelfServe(schoolId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { schoolId } });
  if (!subscription) throw new Error("This school has no subscription.");
  const updated = await prisma.subscription.update({
    where: { schoolId },
    data: { status: "CANCELED", canceledAt: new Date() },
  });
  await notifySubscriptionCancelled(schoolId);
  return updated;
}

/// Reactivating a CANCELED or EXPIRED subscription — same plan, a fresh
/// billing period starting now. Used for "Renew subscription" (spec
/// section 13); data was never touched by cancellation/expiry in the
/// first place, so there's nothing to restore beyond the subscription
/// row's own status.
export async function reactivateSubscriptionSelfServe(schoolId: string, billingInterval: BillingInterval) {
  const subscription = await prisma.subscription.findUnique({ where: { schoolId }, include: { plan: true } });
  if (!subscription) throw new Error("This school has no subscription.");
  if (!["CANCELED", "EXPIRED", "SUSPENDED"].includes(subscription.status)) {
    throw new Error("This subscription is already active.");
  }

  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  if (billingInterval === "YEARLY") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else periodEnd.setMonth(periodEnd.getMonth() + 1);

  const updated = await prisma.subscription.update({
    where: { schoolId },
    data: {
      status: "ACTIVE",
      billingInterval,
      canceledAt: null,
      pastDueSince: null,
      graceEndsAt: null,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    },
    include: { plan: true },
  });

  await prisma.platformInvoice.updateMany({
    where: { schoolId, subscriptionId: updated.id, status: "PENDING" },
    data: { status: "VOID" },
  });

  const amountMinor = planPriceForInterval(subscription.plan, billingInterval);
  if (amountMinor !== null) {
    await prisma.platformInvoice.create({
      data: {
        schoolId,
        subscriptionId: updated.id,
        periodStart,
        periodEnd,
        amountMinor,
        currency: subscription.plan.currency,
        billingInterval,
        dueDate: periodEnd,
      },
    });
  }

  await notifySubscriptionRenewed(schoolId, subscription.plan.name);
  return updated;
}
