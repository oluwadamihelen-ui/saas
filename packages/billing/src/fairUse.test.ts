import { describe, expect, it } from "vitest";
import { evaluateGenerationRequest, isExportResolutionAllowed, isProjectDurationAllowed, type PlanFairUsePolicy } from "./fairUse.js";

const creatorPolicy: PlanFairUsePolicy = {
  planKey: "creator",
  maxConcurrentGenerations: 1,
  queuePriority: "NORMAL",
  maxExportResolution: "1080p",
  maxStorageGB: 50,
  maxProjectDurationMinutes: 30,
};

describe("evaluateGenerationRequest", () => {
  it("allows a generation when under the concurrency ceiling", () => {
    expect(evaluateGenerationRequest(creatorPolicy, 0).allowed).toBe(true);
  });

  it("blocks with a human-readable, credit-free reason when at the ceiling", () => {
    const decision = evaluateGenerationRequest(creatorPolicy, 1);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBeTruthy();
    expect(decision.reason?.toLowerCase()).not.toContain("credit");
  });
});

describe("isExportResolutionAllowed", () => {
  it("allows resolutions at or below the plan ceiling", () => {
    expect(isExportResolutionAllowed(creatorPolicy, "720p")).toBe(true);
    expect(isExportResolutionAllowed(creatorPolicy, "1080p")).toBe(true);
  });

  it("blocks resolutions above the plan ceiling", () => {
    expect(isExportResolutionAllowed(creatorPolicy, "4K")).toBe(false);
  });
});

describe("isProjectDurationAllowed", () => {
  it("respects the plan's maximum project duration", () => {
    expect(isProjectDurationAllowed(creatorPolicy, 20)).toBe(true);
    expect(isProjectDurationAllowed(creatorPolicy, 45)).toBe(false);
  });
});
