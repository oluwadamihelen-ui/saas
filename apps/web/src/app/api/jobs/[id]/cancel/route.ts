import { NextResponse } from "next/server";
import { isTerminal, type GenerationJobStatus } from "@cinerra/domain";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";

/**
 * Cooperative cancellation (spec §24, §57): flips the job to CANCELLED.
 * Reliably stops a job still sitting in the queue — the worker checks for
 * this before it starts real (billed) work and exits cleanly instead of
 * retrying. For SHOT_VIDEO jobs, a background poll in
 * shotGenerationService also watches for this write while a Runway
 * generation is actively in flight (typically minutes) and aborts it —
 * including calling Runway's own cancel endpoint so it stops billing
 * server-side too, not just locally. Other job types' provider calls are
 * short single requests (seconds), so this write still reliably stops
 * them before the next stage begins even without an explicit abort hook.
 *
 * Also resets whatever entity the job was populating back to its
 * pre-generation state, so the UI doesn't stay stuck showing "generating"
 * for something that will never finish.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const job = await prisma.generationJob.findUnique({ where: { id: params.id } });
    if (!job) throw new Error("NOT_FOUND");
    if (job.userId !== userId) throw new Error("FORBIDDEN");

    if (isTerminal(job.status as GenerationJobStatus)) {
      return NextResponse.json({ error: "This generation has already finished and can't be cancelled." }, { status: 409 });
    }

    await prisma.generationJob.update({ where: { id: job.id }, data: { status: "CANCELLED", finishedAt: new Date() } });
    await resetEntityForCancelledJob(job);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

async function resetEntityForCancelledJob(job: { type: string; projectId: string; shotId: string | null; input: unknown }): Promise<void> {
  switch (job.type) {
    case "STORY_OUTLINE":
      await prisma.storyBible.updateMany({ where: { projectId: job.projectId, status: "GENERATING" }, data: { status: "DRAFT" } });
      await prisma.project.updateMany({ where: { id: job.projectId, status: "GENERATING" }, data: { status: "DRAFT" } });
      break;
    case "SCREENPLAY": {
      const { episodeId } = job.input as { episodeId?: string };
      if (episodeId) await prisma.episode.updateMany({ where: { id: episodeId, status: "GENERATING" }, data: { status: "DRAFT" } });
      break;
    }
    case "SHOT_VIDEO":
      if (job.shotId) {
        await prisma.shot.updateMany({
          where: { id: job.shotId, status: { in: ["QUEUED", "GENERATING"] } },
          data: { status: "PENDING" },
        });
      }
      break;
    default:
      // CHARACTER_BIBLE / LOCATION_BIBLE / STORYBOARD / REFERENCE_IMAGE don't
      // flip a visible "generating" flag on their target entities, so there's
      // nothing to reset.
      break;
  }
}
