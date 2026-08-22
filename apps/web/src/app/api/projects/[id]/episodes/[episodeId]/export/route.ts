import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { startEpisodeExport } from "@cinerra/domain";
import { isExportResolutionAllowed } from "@cinerra/billing";
import { bullPriorityFor, QUEUE_NAMES } from "@cinerra/queue";
import { requireUserId } from "@/lib/session";
import { assertCanStartGeneration } from "@/lib/fairUse";
import { enqueueGenerationJob } from "@/lib/queue";
import { toApiErrorResponse } from "@/lib/apiError";

const bodySchema = z.object({
  resolution: z.enum(["720p", "1080p", "4K"]).default("720p"),
});

export async function POST(request: NextRequest, { params }: { params: { id: string; episodeId: string } }) {
  try {
    const userId = await requireUserId();
    const policy = await assertCanStartGeneration(userId);
    const { resolution } = bodySchema.parse(await request.json().catch(() => ({})));

    if (!isExportResolutionAllowed(policy, resolution)) {
      return NextResponse.json(
        { error: `Your plan supports exports up to ${policy.maxExportResolution}. Upgrade your plan for ${resolution} exports.` },
        { status: 403 },
      );
    }

    const { generationJobId } = await startEpisodeExport({
      userId,
      episodeId: params.episodeId,
      resolution,
      enqueue: (jobId) => enqueueGenerationJob(QUEUE_NAMES.export, jobId, bullPriorityFor(policy.queuePriority)),
    });

    return NextResponse.json({ generationJobId }, { status: 202 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return toApiErrorResponse(error);
  }
}
