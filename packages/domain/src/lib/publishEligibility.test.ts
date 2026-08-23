import { describe, expect, it } from "vitest";
import { checkProjectPublishEligibility } from "./publishEligibility.js";

describe("checkProjectPublishEligibility", () => {
  it("is not eligible with no episodes", () => {
    expect(checkProjectPublishEligibility([]).eligible).toBe(false);
  });

  it("is not eligible when no export has succeeded", () => {
    const result = checkProjectPublishEligibility([
      { exports: [{ kind: "EPISODE", status: "FAILED" }] },
      { exports: [{ kind: "EPISODE", status: "QUEUED" }] },
    ]);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it("is not eligible when only a trailer/social clip succeeded, not the full episode", () => {
    const result = checkProjectPublishEligibility([{ exports: [{ kind: "TRAILER", status: "SUCCEEDED" }] }]);
    expect(result.eligible).toBe(false);
  });

  it("is eligible once any episode has a succeeded EPISODE export", () => {
    const result = checkProjectPublishEligibility([
      { exports: [{ kind: "EPISODE", status: "FAILED" }] },
      { exports: [{ kind: "EPISODE", status: "SUCCEEDED" }] },
    ]);
    expect(result.eligible).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});
