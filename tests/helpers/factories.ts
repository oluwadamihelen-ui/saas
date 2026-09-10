import { prisma } from "@/lib/db";
import { PLAN_CATALOG, type PlanTier } from "@/lib/billing/plan-catalog";
import type { SubscriptionStatus, BillingInterval } from "@/generated/prisma/client";

/// Every test school gets this slug prefix so cleanup can find (and never
/// accidentally touch real dev/demo data) everything a test run created,
/// even across a crashed run that skipped its own afterEach.
const TEST_SLUG_PREFIX = "vitest-";

let counter = 0;
function uniqueSlug() {
  counter += 1;
  return `${TEST_SLUG_PREFIX}${Date.now()}-${counter}`;
}

/// Upserts (never overwrites an existing row's price/features — same
/// semantics as ensureDefaultPlans) the 4 catalog plans, so tests don't
/// depend on `npm run db:seed` having been run first.
export async function ensureTestPlans() {
  await Promise.all(
    (Object.keys(PLAN_CATALOG) as PlanTier[]).map((tier) => {
      const entry = PLAN_CATALOG[tier];
      return prisma.subscriptionPlan.upsert({
        where: { slug: entry.slug },
        create: {
          slug: entry.slug,
          name: entry.name,
          tagline: entry.tagline,
          priceMonthlyMinor: entry.priceMonthlyMinor,
          priceAnnualMinor: entry.priceAnnualMinor,
          currency: entry.currency,
          isCustomPricing: entry.isCustomPricing,
          studentLimit: entry.studentLimit,
          isMostPopular: entry.isMostPopular,
          sortOrder: entry.sortOrder,
          features: entry.features,
        },
        update: {},
      });
    })
  );
  return prisma.subscriptionPlan.findMany();
}

/// A bare-bones school + subscription, deliberately skipping everything
/// createSchoolWithOwner also sets up (roles, grade bands, fee categories,
/// ...) — the billing/entitlements code under test never reads any of
/// that, and a minimal fixture keeps each test's intent legible.
export async function createTestSchool(opts: {
  planTier: PlanTier;
  status?: SubscriptionStatus;
  billingInterval?: BillingInterval;
  trialStart?: Date | null;
  trialEnd?: Date | null;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
}) {
  const plans = await ensureTestPlans();
  const plan = plans.find((p) => p.slug === opts.planTier);
  if (!plan) throw new Error(`Test plan ${opts.planTier} not found — ensureTestPlans() should have created it.`);

  const slug = uniqueSlug();
  const school = await prisma.school.create({ data: { name: slug, slug, status: "ACTIVE" } });

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const subscription = await prisma.subscription.create({
    data: {
      schoolId: school.id,
      planId: plan.id,
      status: opts.status ?? "ACTIVE",
      billingInterval: opts.billingInterval ?? "MONTHLY",
      trialStart: opts.trialStart,
      trialEnd: opts.trialEnd,
      currentPeriodStart: opts.currentPeriodStart ?? now,
      currentPeriodEnd: opts.currentPeriodEnd ?? periodEnd,
    },
    include: { plan: true },
  });

  return { school, subscription, plan };
}

/// Grants a bare test school (one created directly via prisma.school.create,
/// not createTestSchool) enough CBT entitlement to exercise the module —
/// PROFESSIONAL covers cbt, cbt_question_bank and cbt_ai_generation, which
/// is every boolean CBT fixtures outside entitlements.test.ts itself need
/// (that file tests plan-tier/limit boundaries directly and sets up its own
/// subscriptions). Without this, requireFeature("cbt", ...) now correctly
/// fails closed on a school with no Subscription row at all — CBT service
/// functions call it as of CBT Phase 9, so every pre-existing CBT test
/// fixture needs a subscription to keep representing real usage.
export async function attachCbtSubscription(schoolId: string) {
  const plans = await ensureTestPlans();
  const plan = plans.find((p) => p.slug === "PROFESSIONAL")!;
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  return prisma.subscription.create({
    data: { schoolId, planId: plan.id, status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd: periodEnd },
  });
}

/// Creates `count` ACTIVE students for a test school — the exact
/// active-student-counting rule (only ACTIVE/SUSPENDED count) lives in
/// entitlements.ts itself; this just needs enough real Student rows to
/// exercise it.
export async function createTestStudents(schoolId: string, count: number) {
  await prisma.student.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      schoolId,
      firstName: "Test",
      lastName: `Student${i}`,
      // A fresh counter tick per row, not just the loop index — this can
      // be called more than once for the same school (e.g. "149 then 1
      // more"), and admissionNumber is unique per (schoolId, this).
      admissionNumber: `VITEST-${uniqueSlug()}-${i}`,
      dateOfBirth: new Date("2015-01-01"),
      gender: "MALE" as const,
      status: "ACTIVE" as const,
    })),
  });
}

/// Deletes every school this test run (or a prior crashed one) created —
/// cascades to Subscription/Student/PlatformInvoice/Notification/etc. via
/// each model's onDelete: Cascade back to School.
export async function cleanupTestSchools() {
  await prisma.school.deleteMany({ where: { slug: { startsWith: TEST_SLUG_PREFIX } } });
}
