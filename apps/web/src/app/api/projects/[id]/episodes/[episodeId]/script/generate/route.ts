import { NextResponse } from "next/server";
import { startScriptGeneration } from "@cinerra/domain";
import { bullPriorityFor } from "@cinerra/queue";
import { requireUserId } from "@/lib/session";
import { assertCanStartGeneration } from "@/lib/fairUse";
import { enqueueGenerationJob } from "@/lib/queue";
import { toApiErrorResponse } from "@/lib/apiError";

export async function POST(_request: Request, { params }: { params: { id: string; episodeId: string } }) {
  try {
    const userId = await requireUserId();
    const policy = await assertCanStartGeneration(userId);

    const { generationJobId } = await startScriptGeneration({
      userId,
      projectId: params.id,
      episodeId: params.episodeId,
      enqueue: (jobId) => enqueueGenerationJob("script-generation", jobId, bullPriorityFor(policy.queuePriority)),
    });

    return NextResponse.json({ generationJobId }, { status: 202 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
