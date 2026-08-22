import { describe, expect, it } from "vitest";
import { buildQcQuestion, parseQcAnswer, summarizeQcFrames } from "./qualityControl.js";

describe("buildQcQuestion", () => {
  it("includes every negative-prompt item to check for", () => {
    const question = buildQcQuestion(["distorted or malformed hands", "watermarks or text overlays"]);
    expect(question).toContain("distorted or malformed hands");
    expect(question).toContain("watermarks or text overlays");
    expect(question).toContain('"pass": boolean, "issues": string[]');
  });
});

describe("parseQcAnswer", () => {
  it("parses a clean pass response", () => {
    expect(parseQcAnswer('{"pass": true, "issues": []}')).toEqual({ pass: true, issues: [] });
  });

  it("parses a failing response with issues", () => {
    expect(parseQcAnswer('{"pass": false, "issues": ["distorted hand", "visible watermark"]}')).toEqual({
      pass: false,
      issues: ["distorted hand", "visible watermark"],
    });
  });

  it("tolerates a markdown-fenced response", () => {
    expect(parseQcAnswer('```json\n{"pass": true, "issues": []}\n```')).toEqual({ pass: true, issues: [] });
  });

  it("drops non-string entries from issues", () => {
    expect(parseQcAnswer('{"pass": false, "issues": ["ok", 5, null]}')).toEqual({ pass: false, issues: ["ok"] });
  });

  it("throws when pass is missing", () => {
    expect(() => parseQcAnswer('{"issues": []}')).toThrow();
  });

  it("throws when the response isn't JSON at all", () => {
    expect(() => parseQcAnswer("looks fine to me")).toThrow();
  });
});

describe("summarizeQcFrames", () => {
  it("scores 1 when every frame passes", () => {
    const report = summarizeQcFrames([
      { atSeconds: 1, pass: true, issues: [] },
      { atSeconds: 2, pass: true, issues: [] },
    ]);
    expect(report.score).toBe(1);
  });

  it("scores the fraction of frames that passed", () => {
    const report = summarizeQcFrames([
      { atSeconds: 1, pass: true, issues: [] },
      { atSeconds: 2, pass: false, issues: ["watermark"] },
      { atSeconds: 3, pass: true, issues: [] },
    ]);
    expect(report.score).toBeCloseTo(2 / 3);
  });

  it("scores 1 for an empty frame list rather than dividing by zero", () => {
    expect(summarizeQcFrames([]).score).toBe(1);
  });
});
