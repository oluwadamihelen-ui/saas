import { prisma } from "@cinerra/database";
import { assertTransition, isTerminal, type GenerationJobStatus } from "../jobStateMachine.js";

export class JobCancelledError extends Error {
  constructor() {
    super("This generation was cancelled.");
    this.name = "JobCancelledError";
  }
}

/**
 * The single place every service writes a GenerationJob status change
 * through — reads the current status, validates the move against the job
 * state machine (throwing InvalidJobTransitionError on a bad move instead
 * of silently writing an invented state), and stamps startedAt/finishedAt
 * consistently.
 */
export async function transitionGenerationJob(
  jobId: string,
  to: GenerationJobStatus,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const current = await prisma.generationJob.findUniqueOrThrow({ where: { id: jobId }, select: { status: true } });
  assertTransition(current.status as GenerationJobStatus, to);

  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status: to,
      startedAt: to === "PROCESSING" ? new Date() : undefined,
      finishedAt: isTerminal(to) ? new Date() : undefined,
      ...extra,
    },
  });
}

/**
 * Call at the top of every job processor instead of transitioning to
 * PROCESSING directly. Handles the two situations a plain transition
 * can't:
 *
 * - **Cooperative cancellation**: if a user cancelled the job (spec §24,
 *   §57) while it sat in the queue, its status is already CANCELLED —
 *   this throws JobCancelledError so the processor bails out immediately
 *   instead of doing wasted (and billed) provider work, and so the
 *   BullMQ job completes rather than endlessly retrying.
 * - **BullMQ-driven retries**: a failed job's row is already FAILED when
 *   BullMQ's own backoff re-invokes the processor — going through
 *   FAILED -> RETRYING -> PROCESSING keeps that a state-machine-valid
 *   hop instead of crashing on every retry attempt.
 */
export async function beginProcessing(jobId: string): Promise<void> {
  const current = await prisma.generationJob.findUniqueOrThrow({ where: { id: jobId }, select: { status: true } });
  const status = current.status as GenerationJobStatus;

  if (status === "CANCELLED") {
    throw new JobCancelledError();
  }
  if (status === "FAILED") {
    await transitionGenerationJob(jobId, "RETRYING");
    await transitionGenerationJob(jobId, "PROCESSING");
    return;
  }
  await transitionGenerationJob(jobId, "PROCESSING");
}
