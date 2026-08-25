import { describe, it, expect } from "vitest";
import {
  PLANS,
  CREDIT_COSTS,
  getStripePriceIdForPlan,
  getPlanForStripePriceId,
  getStripePriceIdForCreditPack,
} from "./plans";

describe("plans config", () => {
  it("defines every PlanId with non-negative limits", () => {
    for (const plan of Object.values(PLANS)) {
      expect(plan.monthlyCredits).toBeGreaterThan(0);
      expect(plan.maxVideoLengthSeconds).toBeGreaterThan(0);
      expect(plan.storageGb).toBeGreaterThan(0);
    }
  });

  it("orders plans by increasing generosity (FREE < STARTER < CREATOR < PRO)", () => {
    expect(PLANS.FREE.monthlyCredits).toBeLessThan(PLANS.STARTER.monthlyCredits);
    expect(PLANS.STARTER.monthlyCredits).toBeLessThan(PLANS.CREATOR.monthlyCredits);
    expect(PLANS.CREATOR.monthlyCredits).toBeLessThan(PLANS.PRO.monthlyCredits);
  });

  it("has no hardcoded dollar amounts on plan config", () => {
    for (const plan of Object.values(PLANS)) {
      expect(plan).not.toHaveProperty("price");
      expect(plan).not.toHaveProperty("priceUsd");
    }
  });

  it("defines a positive credit cost for every operation", () => {
    for (const cost of Object.values(CREDIT_COSTS)) {
      expect(cost).toBeGreaterThan(0);
    }
  });
});

describe("Stripe price id lookups", () => {
  // getStripePriceIdForPlan/getPlanForStripePriceId read a module-level map
  // captured from process.env at import time, so these tests exercise
  // whatever configuration is present in this environment rather than
  // mutating env live (mutation after import would have no effect).

  it("returns null for FREE (never has a Stripe price)", () => {
    expect(getStripePriceIdForPlan("FREE")).toBeNull();
  });

  it("returns a string or null for every paid plan", () => {
    for (const plan of ["STARTER", "CREATOR", "PRO"] as const) {
      const priceId = getStripePriceIdForPlan(plan);
      expect(priceId === null || typeof priceId === "string").toBe(true);
    }
  });

  it("round-trips a configured price id back to its plan via reverse lookup", () => {
    const starterPriceId = getStripePriceIdForPlan("STARTER");
    if (starterPriceId) {
      expect(getPlanForStripePriceId(starterPriceId)).toBe("STARTER");
    }
  });

  it("returns null for an unknown price id", () => {
    expect(getPlanForStripePriceId("price_does_not_exist")).toBeNull();
  });

  it("returns null for a null/undefined price id", () => {
    expect(getPlanForStripePriceId(null)).toBeNull();
    expect(getPlanForStripePriceId(undefined)).toBeNull();
  });

  it("returns a string or null for every credit pack", () => {
    expect(getStripePriceIdForCreditPack("small") === null || typeof getStripePriceIdForCreditPack("small") === "string").toBe(
      true
    );
    expect(getStripePriceIdForCreditPack("large") === null || typeof getStripePriceIdForCreditPack("large") === "string").toBe(
      true
    );
  });
});
