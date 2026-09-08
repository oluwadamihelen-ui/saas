import "server-only";
import { prisma } from "@/lib/db";
import { SUPER_ADMIN_ROLE_KEY } from "@/lib/permissions";
import { PLAN_CATALOG, PLAN_TIERS, TRIAL_PLAN_TIER, TRIAL_PERIOD_DAYS } from "@/lib/billing/plan-catalog";

/// Idempotent, global (not per-school) bootstrap for the single Super Admin
/// role. Deliberately a findFirst-then-create rather than an upsert keyed
/// on the schoolId+key compound unique — Postgres treats every NULL as
/// distinct in a unique index, so that constraint can't actually prevent
/// two schoolId:null rows with the same key from being created, and an
/// upsert's own "does a matching row exist" lookup by a null-valued unique
/// key is exactly the kind of thing worth not relying on.
export async function ensureSuperAdminRole() {
  const existing = await prisma.role.findFirst({ where: { schoolId: null, key: SUPER_ADMIN_ROLE_KEY } });
  if (existing) return existing;
  return prisma.role.create({
    data: { schoolId: null, key: SUPER_ADMIN_ROLE_KEY, name: "Super Admin", isSystem: true },
  });
}

/// Idempotent. Safe to call on every school registration, the same way
/// ensurePermissionCatalog() is. Upserts by `slug`, the stable tier key —
/// `name`/`tagline`/pricing can be edited later by a Super Admin from
/// Settings without this ever re-clobbering that change on the next call,
/// since `update: {}` here only fires for a plan that doesn't exist yet.
export async function ensureDefaultPlans() {
  await Promise.all(
    PLAN_TIERS.map((tier) => {
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
          studentLimit: entry.studentLimit,
          isCustomPricing: entry.isCustomPricing,
          isMostPopular: entry.isMostPopular,
          sortOrder: entry.sortOrder,
          features: entry.features,
        },
        update: {},
      });
    })
  );
  return prisma.subscriptionPlan.findMany({ orderBy: { sortOrder: "asc" } });
}

export { TRIAL_PLAN_TIER, TRIAL_PERIOD_DAYS };
