import { prisma } from "@cinerra/database";
import type { ModelRouter } from "@cinerra/ai";
import { ProviderGenerationError, ProviderNotConfiguredError } from "@cinerra/ai";
import { runScreenwriter } from "../agents/screenwriter.js";
import { beginProcessing, transitionGenerationJob, JobCancelledError } from "./jobTransitions.js";

export interface StartScriptGenerationParams {
  userId: string;
  projectId: string;
  episodeId: string;
  enqueue: (generationJobId: string) => Promise<void>;
}

export async function startScriptGeneration(params: StartScriptGenerationParams): Promise<{ generationJobId: string }> {
  const episode = await prisma.episode.findUniqueOrThrow({ where: { id: params.episodeId }, include: { project: true } });
  if (episode.project.ownerId !== params.userId || episode.projectId !== params.projectId) {
    throw new Error("You do not have access to this episode.");
  }

  const job = await prisma.generationJob.create({
    data: {
      userId: params.userId,
      projectId: params.projectId,
      type: "SCREENPLAY",
      status: "QUEUED",
      input: { episodeId: params.episodeId },
    },
  });

  await prisma.episode.update({ where: { id: episode.id }, data: { status: "GENERATING" } });
  await params.enqueue(job.id);
  return { generationJobId: job.id };
}

export async function runScriptGenerationJob(router: ModelRouter, generationJobId: string): Promise<void> {
  const job = await prisma.generationJob.findUniqueOrThrow({ where: { id: generationJobId } });

  try {
    await beginProcessing(job.id);
  } catch (error) {
    if (error instanceof JobCancelledError) return;
    throw error;
  }

  const { episodeId } = job.input as { episodeId: string };

  try {
    const episode = await prisma.episode.findUniqueOrThrow({
      where: { id: episodeId },
      include: { project: { include: { storyBible: true } } },
    });
    const bible = episode.project.storyBible;
    if (!bible) throw new Error("This project has no Story Bible yet.");

    const output = await runScreenwriter(router, {
      logline: bible.logline,
      premise: bible.premise,
      world: bible.world ?? "",
      storyRules: (bible.storyRules as string[] | null) ?? [],
      episodeNumber: episode.number,
      episodeTitle: episode.title,
      episodeSynopsis: episode.synopsis ?? "",
      visualStyle: episode.project.visualStyle,
    });

    const fullScript = output.scenes.map((s) => s.scriptText).join("\n\n");

    await prisma.$transaction(async (tx) => {
      await tx.episode.update({ where: { id: episode.id }, data: { script: fullScript, status: "DRAFT" } });

      for (const scene of output.scenes) {
        await tx.scene.upsert({
          where: { projectId_number: { projectId: episode.projectId, number: scene.number } },
          create: {
            projectId: episode.projectId,
            episodeId: episode.id,
            number: scene.number,
            intExt: scene.intExt,
            timeOfDay: scene.timeOfDay,
            storyPurpose: scene.storyPurpose,
            emotionalState: scene.emotionalState,
            scriptText: scene.scriptText,
            rawLocationName: scene.locationName,
            rawCharacterNames: scene.characterNames,
          },
          update: {
            intExt: scene.intExt,
            timeOfDay: scene.timeOfDay,
            storyPurpose: scene.storyPurpose,
            emotionalState: scene.emotionalState,
            scriptText: scene.scriptText,
            rawLocationName: scene.locationName,
            rawCharacterNames: scene.characterNames,
          },
        });
      }
    });

    await transitionGenerationJob(job.id, "SUCCEEDED");
  } catch (error) {
    await prisma.episode.update({ where: { id: episodeId }, data: { status: "DRAFT" } }).catch(() => undefined);
    const message =
      error instanceof ProviderNotConfiguredError
        ? "Screenplay generation isn't available yet — no language model provider is configured."
        : error instanceof ProviderGenerationError
          ? "We couldn't generate this screenplay right now. Your project is safe — try again shortly."
          : `We couldn't generate this screenplay: ${error instanceof Error ? error.message : "unexpected error"}`;
    await transitionGenerationJob(job.id, "FAILED", { errorMessage: message, attempts: { increment: 1 } });
    throw error;
  }
}
