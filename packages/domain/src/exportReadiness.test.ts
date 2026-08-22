import { describe, expect, it } from "vitest";
import { checkEpisodeExportReadiness } from "./exportReadiness.js";

describe("checkEpisodeExportReadiness", () => {
  it("refuses an episode with no shots", () => {
    const result = checkEpisodeExportReadiness([]);
    expect(result.ready).toBe(false);
    expect(result.reason).toMatch(/no shots/);
  });

  it("refuses when any shot isn't READY, naming how many are missing", () => {
    const result = checkEpisodeExportReadiness([{ status: "READY" }, { status: "PENDING" }, { status: "FAILED" }]);
    expect(result.ready).toBe(false);
    expect(result.reason).toContain("2 of 3 shots");
  });

  it("allows export once every shot is READY", () => {
    const result = checkEpisodeExportReadiness([{ status: "READY" }, { status: "READY" }]);
    expect(result.ready).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("uses singular phrasing for exactly one shot", () => {
    const result = checkEpisodeExportReadiness([{ status: "PENDING" }]);
    expect(result.reason).toContain("1 of 1 shot ");
  });
});
