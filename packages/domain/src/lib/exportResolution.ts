import type { TargetSize } from "@cinerra/media";

/**
 * Maps a requested export resolution label + the project's aspect ratio to
 * concrete output pixel dimensions, so "resolution" is an actual property
 * of the exported file rather than just a label validated against the
 * plan and otherwise ignored (spec §65).
 */
export function resolveTargetSize(resolution: "720p" | "1080p" | "4K", aspectRatio: "LANDSCAPE_16_9" | "PORTRAIT_9_16" | "SQUARE_1_1"): TargetSize {
  const shortEdge = { "720p": 720, "1080p": 1080, "4K": 2160 }[resolution];

  switch (aspectRatio) {
    case "LANDSCAPE_16_9":
      return { width: Math.round((shortEdge * 16) / 9 / 2) * 2, height: shortEdge };
    case "SQUARE_1_1":
      return { width: shortEdge, height: shortEdge };
    case "PORTRAIT_9_16":
    default:
      return { width: shortEdge, height: Math.round((shortEdge * 16) / 9 / 2) * 2 };
  }
}
