import { prisma } from "@cinerra/database";
import type { ModelRouter } from "@cinerra/ai";
import { ProviderGenerationError, ProviderNotConfiguredError } from "@cinerra/ai";
import { runLocationDesigner } from "../agents/locationDesigner.js";
import { makeEntityCode } from "../lib/codes.js";
import { linkSceneLocations } from "./continuityLinking.js";
import { beginProcessing, transitionGenerationJob, JobCancelledError } from "./jobTransitions.js";

export interface StartLocationGenerationParams {
  userId: string;
  projectId: string;
  enqueue: (generationJobId: string) => Promise<void>;
}

export async function startLocationGeneration(params: StartLocationGenerationParams): Promise<{ generationJobId: string }> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: params.projectId } });
  if (project.ownerId !== params.userId) throw new Error("You do not have access to this project.");

  const sceneCount = await prisma.scene.count({ where: { projectId: project.id } });
  if (sceneCount === 0) {
    throw new Error("Generate a screenplay before generating locations — the Location Designer reads the scenes you've written.");
  }

  const job = await prisma.generationJob.create({
    data: { userId: params.userId, projectId: params.projectId, type: "LOCATION_BIBLE", status: "QUEUED", input: {} },
  });
  await params.enqueue(job.id);
  return { generationJobId: job.id };
}

export async function runLocationGenerationJob(router: ModelRouter, generationJobId: string): Promise<void> {
  const job = await prisma.generationJob.findUniqueOrThrow({ where: { id: generationJobId } });

  try {
    await beginProcessing(job.id);
  } catch (error) {
    if (error instanceof JobCancelledError) return;
    throw error;
  }

  try {
    const project = await prisma.project.findUniqueOrThrow({ where: { id: job.projectId }, include: { storyBible: true } });
    const bible = project.storyBible;
    if (!bible) throw new Error("This project has no Story Bible yet.");

    const scenes = await prisma.scene.findMany({ where: { projectId: project.id }, orderBy: { number: "asc" } });
    const screenplayExcerpt = scenes.map((s) => s.scriptText).filter(Boolean).join("\n\n");

    const output = await runLocationDesigner(router, { world: bible.world ?? "", visualStyle: project.visualStyle, screenplayExcerpt });

    const existing = await prisma.location.findMany({ where: { projectId: project.id } });
    let nextIndex = existing.length + 1;

    await prisma.$transaction(async (tx) => {
      for (const l of output.locations) {
        const already = existing.find((e) => e.name.toLowerCase() === l.name.toLowerCase());
        const code = already?.code ?? makeEntityCode("LOC", l.name, nextIndex++);

        await tx.location.upsert({
          where: { projectId_code: { projectId: project.id, code } },
          create: {
            projectId: project.id,
            code,
            name: l.name,
            architecture: l.architecture,
            lighting: l.lighting,
            colorPalette: l.colorPalette,
            furniture: l.furniture,
            layout: l.layout,
            continuityRules: l.continuityRules,
          },
          update: already?.isLocked
            ? {} // locked locations are never silently rewritten (spec §14)
            : {
                architecture: l.architecture,
                lighting: l.lighting,
                colorPalette: l.colorPalette,
                furniture: l.furniture,
                layout: l.layout,
                continuityRules: l.continuityRules,
              },
        });
      }
    });

    await linkSceneLocations(project.id);
    await transitionGenerationJob(job.id, "SUCCEEDED");
  } catch (error) {
    const message =
      error instanceof ProviderNotConfiguredError
        ? "Location generation isn't available yet — no language model provider is configured."
        : error instanceof ProviderGenerationError
          ? "We couldn't generate locations right now. Your project is safe — try again shortly."
          : `We couldn't generate locations: ${error instanceof Error ? error.message : "unexpected error"}`;
    await transitionGenerationJob(job.id, "FAILED", { errorMessage: message, attempts: { increment: 1 } });
    throw error;
  }
}
