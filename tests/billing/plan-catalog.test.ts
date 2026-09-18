import { describe, it, expect } from "vitest";
import { PLAN_CATALOG, annualSavingsMinor, TRIAL_PLAN_TIER, TRIAL_PERIOD_DAYS } from "@/lib/billing/plan-catalog";

describe("plan catalog pricing", () => {
  it("Starter is ₦25,000/mo and ₦250,000/yr, 150 students", () => {
    expect(PLAN_CATALOG.STARTER.priceMonthlyMinor).toBe(25_000_00);
    expect(PLAN_CATALOG.STARTER.priceAnnualMinor).toBe(250_000_00);
    expect(PLAN_CATALOG.STARTER.studentLimit).toBe(150);
  });

  it("Professional is ₦60,000/mo and ₦600,000/yr, 500 students, most popular", () => {
    expect(PLAN_CATALOG.PROFESSIONAL.priceMonthlyMinor).toBe(60_000_00);
    expect(PLAN_CATALOG.PROFESSIONAL.priceAnnualMinor).toBe(600_000_00);
    expect(PLAN_CATALOG.PROFESSIONAL.studentLimit).toBe(500);
    expect(PLAN_CATALOG.PROFESSIONAL.isMostPopular).toBe(true);
  });

  it("Premium is ₦120,000/mo and ₦1,200,000/yr, 1500 students", () => {
    expect(PLAN_CATALOG.PREMIUM.priceMonthlyMinor).toBe(120_000_00);
    expect(PLAN_CATALOG.PREMIUM.priceAnnualMinor).toBe(1_200_000_00);
    expect(PLAN_CATALOG.PREMIUM.studentLimit).toBe(1_500);
  });

  it("Enterprise has custom pricing and no student limit", () => {
    expect(PLAN_CATALOG.ENTERPRISE.isCustomPricing).toBe(true);
    expect(PLAN_CATALOG.ENTERPRISE.priceMonthlyMinor).toBeNull();
    expect(PLAN_CATALOG.ENTERPRISE.priceAnnualMinor).toBeNull();
    expect(PLAN_CATALOG.ENTERPRISE.studentLimit).toBeNull();
  });

  it("computes the exact annual savings figures", () => {
    expect(annualSavingsMinor(PLAN_CATALOG.STARTER)).toBe(50_000_00);
    expect(annualSavingsMinor(PLAN_CATALOG.PROFESSIONAL)).toBe(120_000_00);
    expect(annualSavingsMinor(PLAN_CATALOG.PREMIUM)).toBe(240_000_00);
  });

  it("annual savings is null for custom-priced plans", () => {
    expect(annualSavingsMinor(PLAN_CATALOG.ENTERPRISE)).toBeNull();
  });

  it("trial grants Professional-tier access for 14 days", () => {
    expect(TRIAL_PLAN_TIER).toBe("PROFESSIONAL");
    expect(TRIAL_PERIOD_DAYS).toBe(14);
  });
});
