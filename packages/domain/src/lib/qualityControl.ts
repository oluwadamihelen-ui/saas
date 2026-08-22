import { extractJson } from "./json.js";

export interface QcFrameResult {
  atSeconds: number;
  pass: boolean;
  issues: string[];
}

export interface QcReport {
  /** Fraction of checked frames that passed, 0-1. 1 means every frame was clean. */
  score: number;
  frames: QcFrameResult[];
}

/**
 * The question sent to the vision model for a single frame — checks
 * specifically against the same artifact list the prompt compiler already
 * asks the video model to avoid (spec §27), so QC and generation share one
 * definition of "acceptable."
 */
export function buildQcQuestion(negativePromptItems: readonly string[]): string {
  return `You are reviewing a single frame from an AI-generated video shot for a film production tool. Check specifically for: ${negativePromptItems.join(", ")}. Respond with ONLY a JSON object, no prose, no markdown fence: {"pass": boolean, "issues": string[]}. "pass" is false if you clearly see ANY of the listed problems present in this frame; list each one found in "issues" using plain language. If the frame looks like normal, clean film footage, respond {"pass": true, "issues": []}.`;
}

/** Throws if the model didn't return a well-formed verdict — callers should treat that as "QC couldn't run," never as a failure. */
export function parseQcAnswer(answer: string): { pass: boolean; issues: string[] } {
  const parsed = extractJson<{ pass?: boolean; issues?: string[] }>(answer);
  if (typeof parsed.pass !== "boolean") {
    throw new Error("QC response did not include a boolean pass field.");
  }
  return { pass: parsed.pass, issues: Array.isArray(parsed.issues) ? parsed.issues.filter((i): i is string => typeof i === "string") : [] };
}

export function summarizeQcFrames(frames: QcFrameResult[]): QcReport {
  const score = frames.length === 0 ? 1 : frames.filter((f) => f.pass).length / frames.length;
  return { score, frames };
}
