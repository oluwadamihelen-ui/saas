import { describe, expect, it } from "vitest";
import { assertTransition, canTransition, InvalidJobTransitionError, isTerminal } from "./jobStateMachine.js";

describe("job state machine", () => {
  it("allows the happy-path sequence through to SUCCEEDED", () => {
    const path: Array<Parameters<typeof canTransition>> = [
      ["QUEUED", "PROCESSING"],
      ["PROCESSING", "PROVIDER_GENERATING"],
      ["PROVIDER_GENERATING", "DOWNLOADING"],
      ["DOWNLOADING", "VALIDATING"],
      ["VALIDATING", "FINALIZING"],
      ["FINALIZING", "SUCCEEDED"],
    ];
    for (const [from, to] of path) {
      expect(canTransition(from, to)).toBe(true);
    }
  });

  it("rejects skipping VALIDATING on the way to SUCCEEDED", () => {
    expect(canTransition("DOWNLOADING", "SUCCEEDED")).toBe(false);
  });

  it("rejects any transition out of a terminal state", () => {
    expect(canTransition("SUCCEEDED", "PROCESSING")).toBe(false);
    expect(canTransition("CANCELLED", "QUEUED")).toBe(false);
  });

  it("allows FAILED to retry via RETRYING", () => {
    expect(canTransition("FAILED", "RETRYING")).toBe(true);
    expect(canTransition("RETRYING", "QUEUED")).toBe(true);
  });

  it("assertTransition throws a descriptive error on an invalid move", () => {
    expect(() => assertTransition("SUCCEEDED", "FAILED")).toThrow(InvalidJobTransitionError);
  });

  it("classifies terminal statuses correctly", () => {
    expect(isTerminal("SUCCEEDED")).toBe(true);
    expect(isTerminal("FAILED")).toBe(true);
    expect(isTerminal("CANCELLED")).toBe(true);
    expect(isTerminal("PROCESSING")).toBe(false);
  });
});
