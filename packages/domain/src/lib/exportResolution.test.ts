import { describe, expect, it } from "vitest";
import { resolveTargetSize } from "./exportResolution.js";

describe("resolveTargetSize", () => {
  it("maps 1080p landscape to the standard 1920x1080", () => {
    expect(resolveTargetSize("1080p", "LANDSCAPE_16_9")).toEqual({ width: 1920, height: 1080 });
  });

  it("maps 1080p portrait to the standard 1080x1920", () => {
    expect(resolveTargetSize("1080p", "PORTRAIT_9_16")).toEqual({ width: 1080, height: 1920 });
  });

  it("maps 720p landscape to 1280x720", () => {
    expect(resolveTargetSize("720p", "LANDSCAPE_16_9")).toEqual({ width: 1280, height: 720 });
  });

  it("maps 4K landscape to 3840x2160", () => {
    expect(resolveTargetSize("4K", "LANDSCAPE_16_9")).toEqual({ width: 3840, height: 2160 });
  });

  it("maps square aspect ratio to equal dimensions at every resolution", () => {
    expect(resolveTargetSize("720p", "SQUARE_1_1")).toEqual({ width: 720, height: 720 });
    expect(resolveTargetSize("1080p", "SQUARE_1_1")).toEqual({ width: 1080, height: 1080 });
  });

  it("always produces even dimensions (required by libx264)", () => {
    for (const resolution of ["720p", "1080p", "4K"] as const) {
      for (const ratio of ["LANDSCAPE_16_9", "PORTRAIT_9_16", "SQUARE_1_1"] as const) {
        const { width, height } = resolveTargetSize(resolution, ratio);
        expect(width % 2).toBe(0);
        expect(height % 2).toBe(0);
      }
    }
  });
});
