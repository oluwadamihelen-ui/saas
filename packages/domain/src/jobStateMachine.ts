/**
 * The generation job state machine (spec §24, §75). Every status
 * transition a worker makes is validated against this table instead of
 * being an unchecked field write — this is what guarantees the UI never
 * observes an invented state and a job can never silently skip
 * VALIDATING on its way to SUCCEEDED.
 */
export type GenerationJobStatus =
  | "QUEUED"
  | "PROCESSING"
  | "PROVIDER_GENERATING"
  | "DOWNLOADING"
  | "VALIDATING"
  | "FINALIZING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "RETRYING";

// Not every job type needs every stage: a text-only agent call (Story
// Architect, Screenwriter, ...) has no provider task to download or asset
// to validate, so it may go straight from PROCESSING to SUCCEEDED. A
// media-generation job (reference image, shot video) walks the full
// PROVIDER_GENERATING -> DOWNLOADING -> [VALIDATING] -> FINALIZING path.
// VALIDATING is likewise optional until a real QC pass exists (spec §27) —
// DOWNLOADING may go straight to FINALIZING for now.
const TRANSITIONS: Record<GenerationJobStatus, GenerationJobStatus[]> = {
  QUEUED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["PROVIDER_GENERATING", "FINALIZING", "SUCCEEDED", "FAILED", "CANCELLED"],
  PROVIDER_GENERATING: ["DOWNLOADING", "FAILED", "CANCELLED", "RETRYING"],
  DOWNLOADING: ["VALIDATING", "FINALIZING", "FAILED", "CANCELLED"],
  VALIDATING: ["FINALIZING", "RETRYING", "FAILED"],
  FINALIZING: ["SUCCEEDED", "FAILED"],
  SUCCEEDED: [],
  FAILED: ["RETRYING"],
  CANCELLED: [],
  RETRYING: ["PROCESSING", "QUEUED", "FAILED"],
};

export const TERMINAL_STATUSES: ReadonlySet<GenerationJobStatus> = new Set(["SUCCEEDED", "FAILED", "CANCELLED"]);

export function canTransition(from: GenerationJobStatus, to: GenerationJobStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export class InvalidJobTransitionError extends Error {
  constructor(from: GenerationJobStatus, to: GenerationJobStatus) {
    super(`Cannot transition generation job from ${from} to ${to}.`);
    this.name = "InvalidJobTransitionError";
  }
}

export function assertTransition(from: GenerationJobStatus, to: GenerationJobStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidJobTransitionError(from, to);
  }
}

export function isTerminal(status: GenerationJobStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}
