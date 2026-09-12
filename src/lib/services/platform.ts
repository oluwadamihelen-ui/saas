import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma, SchoolStatus, SubscriptionStatus, BillingInterval, PlatformInvoiceStatus } from "@/generated/prisma/client";

const SCHOOL_STATUS_KEYS: SchoolStatus[] = ["TRIAL", "ACTIVE", "SUSPENDED"];
const SUBSCRIPTION_STATUS_KEYS: SubscriptionStatus[] = ["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED", "EXPIRED", "SUSPENDED"];

/// A plan's price for whichever interval a specific subscription is on —
/// the one place that decision is made, so MRR/invoice-generation/display
/// can never pick the wrong one independently. Custom-priced (Enterprise)
/// plans have neither price set; callers treat that null the same way
/// they'd treat "no plan" for revenue math (a contract price isn't in the
/// database, so it can't be counted without inventing a number).
export function planPriceForInterval(
  plan: { priceMonthlyMinor: number | null; priceAnnualMinor: number | null },
  interval: BillingInterval
): number | null {
  return interval === "YEARLY" ? plan.priceAnnualMinor : plan.priceMonthlyMinor;
}

/// Normalizes any subscription's price to a monthly-equivalent, so MRR can
/// sum across a mix of monthly and annual subscribers on the same footing
/// (spec section 23's "revenue by billing interval" needs the un-normalized
/// figures too — see getRevenueBreakdown below).
function monthlyEquivalentMinor(
  plan: { priceMonthlyMinor: number | null; priceAnnualMinor: number | null },
  interval: BillingInterval
): number {
  const price = planPriceForInterval(plan, interval);
  if (price === null) return 0;
  return interval === "YEARLY" ? Math.round(price / 12) : price;
}

export async function getPlatformStats() {
  const [schoolsByStatus, totalStudents, activeAndPastDueSubscriptions, subscriptionsByStatus, overdueInvoices, expiringTrials] =
    await Promise.all([
      prisma.school.groupBy({ by: ["status"], _count: true }),
      prisma.student.count({ where: { status: "ACTIVE" } }),
      prisma.subscription.findMany({ where: { status: { in: ["ACTIVE", "PAST_DUE"] } }, include: { plan: true } }),
      prisma.subscription.groupBy({ by: ["status"], _count: true }),
      prisma.platformInvoice.count({ where: { status: "OVERDUE" } }),
      prisma.subscription.count({
        where: { status: "TRIALING", trialEnd: { gte: new Date(), lte: new Date(Date.now() + 7 * 86_400_000) } },
      }),
    ]);

  const statusCounts: Record<SchoolStatus, number> = { TRIAL: 0, ACTIVE: 0, SUSPENDED: 0 };
  for (const row of schoolsByStatus) statusCounts[row.status] = row._count;
  const totalSchools = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  const subscriptionStatusCounts: Record<SubscriptionStatus, number> = {
    TRIALING: 0,
    ACTIVE: 0,
    PAST_DUE: 0,
    CANCELED: 0,
    EXPIRED: 0,
    SUSPENDED: 0,
  };
  for (const row of subscriptionsByStatus) subscriptionStatusCounts[row.status] = row._count;

  /// MRR/ARR only counts paying (ACTIVE + PAST_DUE, i.e. still-billing)
  /// subscriptions, not TRIALING ones — standard SaaS convention, a trial
  /// hasn't actually paid. Real database data only (spec section 23) —
  /// no synthetic growth curve, since this app has no historical
  /// time-series to compute one from yet.
  const mrrMinor = activeAndPastDueSubscriptions.reduce(
    (sum, s) => sum + monthlyEquivalentMinor(s.plan, s.billingInterval),
    0
  );
  const arrMinor = mrrMinor * 12;

  const planMix = new Map<string, { planName: string; count: number }>();
  for (const s of activeAndPastDueSubscriptions) {
    const existing = planMix.get(s.planId);
    if (existing) existing.count += 1;
    else planMix.set(s.planId, { planName: s.plan.name, count: 1 });
  }

  return {
    totalSchools,
    statusCounts,
    totalStudents,
    activeSubscriptionCount: subscriptionStatusCounts.ACTIVE,
    trialingSubscriptions: subscriptionStatusCounts.TRIALING,
    subscriptionStatusCounts,
    overdueInvoices,
    expiringTrials,
    mrrMinor,
    arrMinor,
    planMix: [...planMix.values()],
  };
}

/// Revenue split by billing interval (spec section 23) — un-normalized
/// (a yearly subscriber's actual annual price, not divided by 12), unlike
/// mrrMinor above which deliberately normalizes everything to monthly.
export async function getRevenueByInterval() {
  const subscriptions = await prisma.subscription.findMany({
    where: { status: { in: ["ACTIVE", "PAST_DUE"] } },
    include: { plan: true },
  });
  let monthlyMinor = 0;
  let yearlyMinor = 0;
  for (const s of subscriptions) {
    const price = planPriceForInterval(s.plan, s.billingInterval) ?? 0;
    if (s.billingInterval === "YEARLY") yearlyMinor += price;
    else monthlyMinor += price;
  }
  return { monthlyMinor, yearlyMinor };
}

/// Rough, honest churn signal (spec section 23: real data only, never a
/// synthetic curve) — subscriptions actually cancelled in the trailing 30
/// days, against currently-paying subscriptions as the denominator. EXPIRED
/// subscriptions aren't counted (no timestamp records when a lazily-
/// reconciled expiry happened, so a "last 30 days" window for those would
/// be a guess, not a fact) — CANCELED is the one status this app can time
/// precisely, via canceledAt.
export async function getChurnMetrics() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
  const [canceledLast30Days, activeAndPastDue] = await Promise.all([
    prisma.subscription.count({ where: { status: "CANCELED", canceledAt: { gte: thirtyDaysAgo } } }),
    prisma.subscription.count({ where: { status: { in: ["ACTIVE", "PAST_DUE"] } } }),
  ]);
  const denominator = activeAndPastDue + canceledLast30Days;
  return {
    canceledLast30Days,
    churnRatePercent: denominator > 0 ? Math.round((canceledLast30Days / denominator) * 1000) / 10 : 0,
  };
}

/// Schools whose trial ends within 7 days (spec section 23's "expiring
/// trials" list) — getPlatformStats only needs the count, this is the
/// detail list for the billing dashboard.
export async function getExpiringTrialSchools() {
  return prisma.subscription.findMany({
    where: { status: "TRIALING", trialEnd: { gte: new Date(), lte: new Date(Date.now() + 7 * 86_400_000) } },
    include: { school: true, plan: true },
    orderBy: { trialEnd: "asc" },
  });
}

export async function getOverduePlatformInvoices() {
  return prisma.platformInvoice.findMany({
    where: { status: "OVERDUE" },
    include: { school: true },
    orderBy: { dueDate: "asc" },
  });
}

const SCHOOL_PAGE_SIZE = 20;

export async function listSchoolsForPlatform(search: string | undefined, page = 1) {
  const currentPage = Math.max(1, page);
  const where: Prisma.SchoolWhereInput = search
    ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { slug: { contains: search, mode: "insensitive" } }] }
    : {};

  const [schools, total] = await Promise.all([
    prisma.school.findMany({
      where,
      include: { subscription: { include: { plan: true } }, _count: { select: { students: true, users: true } } },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * SCHOOL_PAGE_SIZE,
      take: SCHOOL_PAGE_SIZE,
    }),
    prisma.school.count({ where }),
  ]);

  return { schools, total, page: currentPage, pageCount: Math.max(1, Math.ceil(total / SCHOOL_PAGE_SIZE)) };
}

export async function getSchoolForPlatform(id: string) {
  return prisma.school.findUnique({
    where: { id },
    include: {
      subscription: { include: { plan: true } },
      _count: { select: { students: true, users: true } },
      platformInvoices: { orderBy: { periodStart: "desc" }, include: { markedPaidBy: true } },
    },
  });
}

export async function updateSchoolStatus(schoolId: string, status: SchoolStatus) {
  return prisma.school.update({ where: { id: schoolId }, data: { status } });
}

export async function changeSchoolPlan(schoolId: string, planId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { schoolId } });
  if (!subscription) throw new Error("This school has no subscription to change.");
  return prisma.subscription.update({ where: { schoolId }, data: { planId } });
}

/// For a school that predates a plan existing, or was otherwise never
/// enrolled — createSchoolWithOwner enrolls every new signup automatically,
/// but a Super Admin still needs a way to onboard an existing school with
/// none rather than that being a permanent dead end in the UI.
export async function createSubscriptionForSchool(schoolId: string, planId: string) {
  const existing = await prisma.subscription.findUnique({ where: { schoolId } });
  if (existing) throw new Error("This school already has a subscription.");

  // A deliberate administrative action, not a fresh self-serve signup, so
  // this starts ACTIVE rather than another trial window — a Super Admin
  // can still move it to TRIALING/PAST_DUE/etc. afterward via
  // updateSubscriptionStatusAction if that's actually what's intended.
  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  return prisma.subscription.create({
    data: { schoolId, planId, status: "ACTIVE", billingInterval: "MONTHLY", currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
  });
}

/// Every manual status change from the platform admin UI goes through
/// here — SUSPENDED is deliberately allowed as a target the same way the
/// others are (spec section 22: "Suspend subscription" / "Reactivate
/// subscription"), the caller (server action) is what logs the audit
/// entry.
export async function updateSubscriptionStatus(schoolId: string, status: SubscriptionStatus) {
  const subscription = await prisma.subscription.findUnique({ where: { schoolId } });
  if (!subscription) throw new Error("This school has no subscription.");
  return prisma.subscription.update({
    where: { schoolId },
    data: { status, canceledAt: status === "CANCELED" ? new Date() : null },
  });
}

/// One invoice per subscription's current period — regenerating while the
/// latest invoice for this period is still PENDING/OVERDUE just returns it
/// rather than creating a duplicate. Amount is whichever price the
/// subscription's own billingInterval resolves to; an Enterprise
/// (isCustomPricing) subscription has no plan price to snapshot, so this
/// throws rather than silently billing ₦0 — a Super Admin sets a custom
/// invoice amount by contract, outside this generic path.
export async function generatePlatformInvoice(schoolId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { schoolId }, include: { plan: true } });
  if (!subscription) throw new Error("This school has no subscription.");

  const existing = await prisma.platformInvoice.findFirst({
    where: { schoolId, subscriptionId: subscription.id, periodStart: subscription.currentPeriodStart, status: { in: ["PENDING", "OVERDUE"] } },
  });
  if (existing) return existing;

  const amountMinor = planPriceForInterval(subscription.plan, subscription.billingInterval);
  if (amountMinor === null) {
    throw new Error("This plan has custom pricing — set an invoice amount manually rather than auto-generating one.");
  }

  return prisma.platformInvoice.create({
    data: {
      schoolId,
      subscriptionId: subscription.id,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      amountMinor,
      currency: subscription.plan.currency,
      billingInterval: subscription.billingInterval,
      dueDate: subscription.currentPeriodEnd,
    },
  });
}

export async function markPlatformInvoicePaid(invoiceId: string, markedPaidById: string) {
  const invoice = await prisma.platformInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status === "PAID") throw new Error("This invoice is already paid.");
  return prisma.platformInvoice.update({
    where: { id: invoiceId },
    data: { status: "PAID", paidAt: new Date(), markedPaidById },
  });
}

export async function voidPlatformInvoice(invoiceId: string) {
  const invoice = await prisma.platformInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status === "PAID") throw new Error("A paid invoice can't be voided.");
  return prisma.platformInvoice.update({ where: { id: invoiceId }, data: { status: "VOID" } });
}

export async function listPlans() {
  return prisma.subscriptionPlan.findMany({ orderBy: { sortOrder: "asc" } });
}

export interface PlanInput {
  name: string;
  tagline?: string | null;
  priceMonthlyMinor?: number | null;
  priceAnnualMinor?: number | null;
  currency?: string;
  isCustomPricing?: boolean;
  studentLimit?: number | null;
  cbtActiveExamLimit?: number | null;
  cbtQuestionBankLimit?: number | null;
  cbtAiQuestionsPerMonthLimit?: number | null;
  cbtCandidateLimit?: number | null;
  isMostPopular?: boolean;
  features?: Record<string, boolean>;
}

export async function createPlan(slug: string, input: PlanInput) {
  const maxSort = await prisma.subscriptionPlan.aggregate({ _max: { sortOrder: true } });
  return prisma.subscriptionPlan.create({
    data: {
      slug,
      name: input.name,
      tagline: input.tagline ?? null,
      priceMonthlyMinor: input.priceMonthlyMinor ?? null,
      priceAnnualMinor: input.priceAnnualMinor ?? null,
      currency: input.currency ?? "NGN",
      isCustomPricing: input.isCustomPricing ?? false,
      studentLimit: input.studentLimit ?? null,
      cbtActiveExamLimit: input.cbtActiveExamLimit ?? null,
      cbtQuestionBankLimit: input.cbtQuestionBankLimit ?? null,
      cbtAiQuestionsPerMonthLimit: input.cbtAiQuestionsPerMonthLimit ?? null,
      cbtCandidateLimit: input.cbtCandidateLimit ?? null,
      isMostPopular: input.isMostPopular ?? false,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      features: input.features ?? {},
    },
  });
}

/// Existing subscriptions keep referencing this plan by id, and past
/// PlatformInvoice rows already snapshotted their own amountMinor at
/// generation time (the same pattern payroll uses for payslips) — so
/// editing a plan only ever changes what happens going forward, never
/// rewrites history.
export async function updatePlan(planId: string, input: PlanInput) {
  return prisma.subscriptionPlan.update({
    where: { id: planId },
    data: {
      name: input.name,
      tagline: input.tagline,
      priceMonthlyMinor: input.priceMonthlyMinor,
      priceAnnualMinor: input.priceAnnualMinor,
      currency: input.currency,
      isCustomPricing: input.isCustomPricing,
      studentLimit: input.studentLimit,
      cbtActiveExamLimit: input.cbtActiveExamLimit,
      cbtQuestionBankLimit: input.cbtQuestionBankLimit,
      cbtAiQuestionsPerMonthLimit: input.cbtAiQuestionsPerMonthLimit,
      cbtCandidateLimit: input.cbtCandidateLimit,
      isMostPopular: input.isMostPopular,
      features: input.features,
    },
  });
}

/// Merges into the existing features map rather than replacing it, so a
/// Super Admin toggling one feature from the plan-config UI never has to
/// resend the other forty in the same request.
export async function updatePlanFeatures(planId: string, features: Record<string, boolean>) {
  const plan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { id: planId } });
  const current = (plan.features as Record<string, boolean>) ?? {};
  return prisma.subscriptionPlan.update({ where: { id: planId }, data: { features: { ...current, ...features } } });
}

export async function setPlanActive(planId: string, isActive: boolean) {
  return prisma.subscriptionPlan.update({ where: { id: planId }, data: { isActive } });
}

/// Real starting numbers for the Unit Economics calculator (/platform/costs)
/// — every school currently paying (ACTIVE or PAST_DUE, same "still
/// billing" convention as MRR above) grouped by the plan's *current*
/// database price, never a hardcoded catalog snapshot (a Super Admin may
/// have already edited a plan's price from Settings). The calculator
/// itself is a client-side what-if tool; this only supplies its defaults.
export async function getCostCalculatorData() {
  const [plans, subscriptionCounts] = await Promise.all([
    listPlans(),
    prisma.subscription.groupBy({ by: ["planId"], where: { status: { in: ["ACTIVE", "PAST_DUE"] } }, _count: true }),
  ]);
  const countByPlanId = new Map(subscriptionCounts.map((s) => [s.planId, s._count]));

  return plans
    .filter((p) => p.isActive)
    .map((plan) => ({
      id: plan.id,
      name: plan.name,
      priceMonthlyMinor: plan.priceMonthlyMinor,
      priceAnnualMinor: plan.priceAnnualMinor,
      currency: plan.currency,
      isCustomPricing: plan.isCustomPricing,
      activeSchoolCount: countByPlanId.get(plan.id) ?? 0,
    }));
}

export { SCHOOL_STATUS_KEYS, SUBSCRIPTION_STATUS_KEYS };
export type { PlatformInvoiceStatus, SubscriptionStatus };
