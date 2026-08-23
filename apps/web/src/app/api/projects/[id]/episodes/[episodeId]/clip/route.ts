import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { startClipGeneration } from "@cinerra/domain";
import { bullPriorityFor, QUEUE_NAMES } from "@cinerra/queue";
import { requireUserId } from "@/lib/session";
import { assertCanStartGeneration } from "@/lib/fairUse";
import { enqueueGenerationJob } from "@/lib/queue";
import { toApiErrorResponse } from "@/lib/apiError";

const bodySchema = z.object({
  kind: z.enum(["TRAILER", "SOCIAL_CLIP"]),
});

export async function POST(request: NextRequest, { params }: { params: { id: string; episodeId: string } }) {
  try {
    const userId = await requireUserId();
    const policy = await assertCanStartGeneration(userId);
    const { kind } = bodySchema.parse(await request.json().catch(() => ({})));

    const { generationJobId } = await startClipGeneration({
      userId,
      episodeId: params.episodeId,
      kind,
      enqueue: (jobId) => enqueueGenerationJob(QUEUE_NAMES.clipGeneration, jobId, bullPriorityFor(policy.queuePriority)),
    });

    return NextResponse.json({ generationJobId }, { status: 202 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return toApiErrorResponse(error);
  }
}
