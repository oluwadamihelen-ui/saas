import "server-only";
import { prisma } from "@/lib/db";
import { SUPER_ADMIN_ROLE_KEY } from "@/lib/permissions";

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

const DEFAULT_PLANS = [
  { name: "Starter", priceMinor: 1_500_000, billingInterval: "MONTHLY" as const, studentLimit: 150 },
  { name: "Growth", priceMinor: 4_500_000, billingInterval: "MONTHLY" as const, studentLimit: 500 },
  { name: "Enterprise", priceMinor: 12_000_000, billingInterval: "MONTHLY" as const, studentLimit: null },
];

/// Idempotent. Safe to call on every school registration, the same way
/// ensurePermissionCatalog() is — a handful of upserts on a unique `name`,
/// not a migration.
export async function ensureDefaultPlans() {
  await Promise.all(
    DEFAULT_PLANS.map((p) =>
      prisma.subscriptionPlan.upsert({
        where: { name: p.name },
        create: p,
        update: {},
      })
    )
  );
  return prisma.subscriptionPlan.findMany({ orderBy: { priceMinor: "asc" } });
}

export const DEFAULT_SIGNUP_PLAN_NAME = "Starter";
export const TRIAL_PERIOD_DAYS = 30;
