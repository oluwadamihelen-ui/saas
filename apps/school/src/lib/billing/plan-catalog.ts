import { PLAN_TIER_DEFAULT_FEATURES, featureListToMap } from "./features";

export type PlanTier = "STARTER" | "PROFESSIONAL" | "PREMIUM" | "ENTERPRISE";

export const PLAN_TIERS: PlanTier[] = ["STARTER", "PROFESSIONAL", "PREMIUM", "ENTERPRISE"];

/// The single authoritative source for plan pricing/limits (spec section
/// 37) — nothing in the UI hard-codes a price. This constant only seeds
/// SubscriptionPlan rows (see prisma/seed and platform-provisioning.ts);
/// every runtime read goes through the database (listPlans()), so a Super
/// Admin can still change a live price from Settings without a deploy —
/// this file is what a *new* environment starts from, not a cache.
export interface PlanCatalogEntry {
  tier: PlanTier;
  slug: PlanTier;
  name: string;
  tagline: string;
  /// Minor units (kobo). Null for Enterprise (isCustomPricing instead).
  priceMonthlyMinor: number | null;
  priceAnnualMinor: number | null;
  currency: string;
  studentLimit: number | null;
  isCustomPricing: boolean;
  isMostPopular: boolean;
  sortOrder: number;
  features: Record<string, boolean>;
}

export const PLAN_CATALOG: Record<PlanTier, PlanCatalogEntry> = {
  STARTER: {
    tier: "STARTER",
    slug: "STARTER",
    name: "Starter",
    tagline: "For small schools getting started.",
    priceMonthlyMinor: 25_000_00,
    priceAnnualMinor: 250_000_00,
    currency: "NGN",
    studentLimit: 150,
    isCustomPricing: false,
    isMostPopular: false,
    sortOrder: 0,
    features: featureListToMap(PLAN_TIER_DEFAULT_FEATURES.STARTER),
  },
  PROFESSIONAL: {
    tier: "PROFESSIONAL",
    slug: "PROFESSIONAL",
    name: "Professional",
    tagline: "For growing schools.",
    priceMonthlyMinor: 60_000_00,
    priceAnnualMinor: 600_000_00,
    currency: "NGN",
    studentLimit: 500,
    isCustomPricing: false,
    isMostPopular: true,
    sortOrder: 1,
    features: featureListToMap(PLAN_TIER_DEFAULT_FEATURES.PROFESSIONAL),
  },
  PREMIUM: {
    tier: "PREMIUM",
    slug: "PREMIUM",
    name: "Premium",
    tagline: "For established schools.",
    priceMonthlyMinor: 120_000_00,
    priceAnnualMinor: 1_200_000_00,
    currency: "NGN",
    studentLimit: 1_500,
    isCustomPricing: false,
    isMostPopular: false,
    sortOrder: 2,
    features: featureListToMap(PLAN_TIER_DEFAULT_FEATURES.PREMIUM),
  },
  ENTERPRISE: {
    tier: "ENTERPRISE",
    slug: "ENTERPRISE",
    name: "Enterprise",
    tagline: "For large school groups.",
    priceMonthlyMinor: null,
    priceAnnualMinor: null,
    currency: "NGN",
    studentLimit: null,
    isCustomPricing: true,
    isMostPopular: false,
    sortOrder: 3,
    features: featureListToMap(PLAN_TIER_DEFAULT_FEATURES.ENTERPRISE),
  },
};

/// Which plan tier a new trial grants access to (spec section 6: "give the
/// school access to the PROFESSIONAL plan" during trial) — kept as one
/// named constant rather than a literal scattered across provisioning code.
export const TRIAL_PLAN_TIER: PlanTier = "PROFESSIONAL";
export const TRIAL_PERIOD_DAYS = 14;

/// 12 * monthly - annual, computed (not hand-typed) so it can never drift
/// from the actual stored prices — spec section 5's worked examples.
export function annualSavingsMinor(entry: Pick<PlanCatalogEntry, "priceMonthlyMinor" | "priceAnnualMinor">): number | null {
  if (entry.priceMonthlyMinor == null || entry.priceAnnualMinor == null) return null;
  return entry.priceMonthlyMinor * 12 - entry.priceAnnualMinor;
}
