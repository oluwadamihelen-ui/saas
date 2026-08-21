import { NextResponse } from "next/server";
import { startShotGeneration } from "@cinerra/domain";
import { bullPriorityFor, QUEUE_NAMES } from "@cinerra/queue";
import { requireUserId } from "@/lib/session";
import { assertCanStartGeneration } from "@/lib/fairUse";
import { enqueueGenerationJob } from "@/lib/queue";
import { toApiErrorResponse } from "@/lib/apiError";
import { prisma } from "@/lib/db";

/** Shared by both POST /api/shots/:id/generate and .../regenerate — same operation, different entry point. */
export async function handleShotGenerationRequest(shotId: string): Promise<NextResponse> {
  try {
    const userId = await requireUserId();
    const policy = await assertCanStartGeneration(userId);

    const shot = await prisma.shot.findUnique({ where: { id: shotId } });
    if (shot && (shot.status === "QUEUED" || shot.status === "GENERATING")) {
      return NextResponse.json({ error: "This shot is already generating." }, { status: 409 });
    }

    const { generationJobId } = await startShotGeneration({
      userId,
      shotId,
      enqueue: (jobId) => enqueueGenerationJob(QUEUE_NAMES.shotGeneration, jobId, bullPriorityFor(policy.queuePriority)),
    });

    return NextResponse.json({ generationJobId }, { status: 202 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
