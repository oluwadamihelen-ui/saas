import { describe, expect, it } from "vitest";
import { assignDefaultVoiceId } from "./voices.js";

describe("assignDefaultVoiceId", () => {
  it("is deterministic for the same character id", () => {
    expect(assignDefaultVoiceId("char_123", "female")).toBe(assignDefaultVoiceId("char_123", "female"));
  });

  it("picks from a different pool for male vs female", () => {
    const femaleVoices = new Set(["21m00Tcm4TlvDq8ikWAM", "EXAVITQu4vr4xnSDxMaL"]);
    const maleVoices = new Set(["ErXwobaYiN019PkySvjV", "TxGEqnHWrfWFTfGW9XjX"]);
    expect(femaleVoices.has(assignDefaultVoiceId("char_1", "female"))).toBe(true);
    expect(maleVoices.has(assignDefaultVoiceId("char_1", "male"))).toBe(true);
  });

  it("falls back to the male pool when gender is unspecified", () => {
    const maleVoices = new Set(["ErXwobaYiN019PkySvjV", "TxGEqnHWrfWFTfGW9XjX"]);
    expect(maleVoices.has(assignDefaultVoiceId("char_1", null))).toBe(true);
  });
});
