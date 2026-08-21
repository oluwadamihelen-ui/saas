import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { startStoryGeneration } from "@cinerra/domain";
import { bullPriorityFor } from "@cinerra/queue";
import { requireUserId } from "@/lib/session";
import { assertCanStartGeneration } from "@/lib/fairUse";
import { enqueueGenerationJob } from "@/lib/queue";
import { toApiErrorResponse } from "@/lib/apiError";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  storyIdea: z.string().min(1).optional(),
  genres: z.array(z.string()).default([]),
  tones: z.array(z.string()).default([]),
  setting: z.string().optional(),
  targetAudience: z.string().optional(),
});

/**
 * Kicks off Inspiration Mode / Adaptation Mode story generation
 * (spec §10-11, §54). Returns immediately with a job id — the browser
 * never blocks on the LLM call; the wizard polls GET /api/jobs/:id for
 * state-based progress.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const policy = await assertCanStartGeneration(userId);
    const body = bodySchema.parse(await request.json());

    const project = await prisma.project.findUniqueOrThrow({ where: { id: params.id } });
    if (project.ownerId !== userId) throw new Error("FORBIDDEN");

    const sourceMaterialSummary = project.mode === "ADAPTATION" ? project.sourceText ?? undefined : undefined;
    if (project.mode === "ADAPTATION" && !sourceMaterialSummary) {
      return NextResponse.json({ error: "Upload or paste your source material before generating an adaptation." }, { status: 400 });
    }
    if (project.mode === "INSPIRATION" && !body.storyIdea) {
      return NextResponse.json({ error: "Describe the movie you want to create before generating a story." }, { status: 400 });
    }

    const { generationJobId } = await startStoryGeneration({
      userId,
      projectId: project.id,
      input: {
        storyIdea: body.storyIdea ?? "",
        genres: body.genres,
        tones: body.tones,
        setting: body.setting,
        targetAudience: body.targetAudience,
        format: project.format,
        episodeCount: project.episodeCount,
        sourceMaterialSummary,
      },
      enqueue: (jobId) => enqueueGenerationJob("story-generation", jobId, bullPriorityFor(policy.queuePriority)),
    });

    return NextResponse.json({ generationJobId }, { status: 202 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
