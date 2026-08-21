import { NextResponse } from "next/server";
import { startLocationGeneration } from "@cinerra/domain";
import { bullPriorityFor, QUEUE_NAMES } from "@cinerra/queue";
import { requireUserId } from "@/lib/session";
import { assertCanStartGeneration } from "@/lib/fairUse";
import { enqueueGenerationJob } from "@/lib/queue";
import { toApiErrorResponse } from "@/lib/apiError";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const policy = await assertCanStartGeneration(userId);

    const { generationJobId } = await startLocationGeneration({
      userId,
      projectId: params.id,
      enqueue: (jobId) => enqueueGenerationJob(QUEUE_NAMES.locationGeneration, jobId, bullPriorityFor(policy.queuePriority)),
    });

    return NextResponse.json({ generationJobId }, { status: 202 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
