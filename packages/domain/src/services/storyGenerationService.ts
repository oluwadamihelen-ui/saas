import { prisma, chargeForGeneration, refundGenerationCharge, InsufficientGenerationDoeError, AlreadyChargedError } from "@cinerra/database";
import type { ModelRouter } from "@cinerra/ai";
import { ProviderNotConfiguredError, ProviderGenerationError } from "@cinerra/ai";
import { runStoryArchitect, type StoryArchitectInput } from "../agents/storyArchitect.js";
import { beginProcessing, transitionGenerationJob, JobCancelledError } from "./jobTransitions.js";

export interface StartStoryGenerationParams {
  userId: string;
  projectId: string;
  input: StoryArchitectInput;
  /** Injected so this package never depends on a concrete queue implementation. */
  enqueue: (generationJobId: string) => Promise<void>;
}

/**
 * Called from the API route. Persists the job request (so it survives a
 * page refresh / lost connection, spec §36) and hands it to the caller's
 * queue. Fair-use concurrency is enforced by the caller before this runs.
 */
export async function startStoryGeneration(params: StartStoryGenerationParams): Promise<{ generationJobId: string }> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: params.projectId } });
  if (project.ownerId !== params.userId) {
    throw new Error("You do not have access to this project.");
  }

  const job = await prisma.generationJob.create({
    data: {
      userId: params.userId,
      projectId: params.projectId,
      type: "STORY_OUTLINE",
      status: "QUEUED",
      input: params.input as unknown as object,
    },
  });

  await prisma.storyBible.upsert({
    where: { projectId: params.projectId },
    create: {
      projectId: params.projectId,
      logline: "",
      premise: "",
      genres: params.input.genres,
      tones: params.input.tones,
      setting: params.input.setting,
      targetAudience: params.input.targetAudience,
      status: "GENERATING",
      generatedByJobId: job.id,
    },
    update: { status: "GENERATING", generatedByJobId: job.id },
  });

  await prisma.project.update({ where: { id: params.projectId }, data: { status: "GENERATING" } });

  await params.enqueue(job.id);
  return { generationJobId: job.id };
}

/**
 * Executed by the worker. Runs the Story Architect agent and persists its
 * output into the canonical Story Bible + Episode rows. On any failure the
 * job is marked FAILED with a human-readable message (spec §56) — never a
 * raw stack trace, and the project is left in a safe, editable state.
 */
export async function runStoryGenerationJob(router: ModelRouter, generationJobId: string): Promise<void> {
  const job = await prisma.generationJob.findUniqueOrThrow({ where: { id: generationJobId } });

  try {
    await beginProcessing(job.id);
  } catch (error) {
    if (error instanceof JobCancelledError) return;
    throw error;
  }

  let charged = false;
  let doeAmount = 0;

  try {
    const platformSettings = await prisma.platformSettings.findUniqueOrThrow({ where: { id: "singleton" } });
    doeAmount = platformSettings.doeCostPerTextGeneration;
    try {
      await prisma.$transaction((tx) =>
        chargeForGeneration(tx, {
          userId: job.userId,
          doeAmount,
          referenceType: "GenerationJob",
          referenceId: job.id,
          idempotencyKey: `generation-spend:${job.id}`,
        }),
      );
      charged = true;
    } catch (chargeError) {
      if (chargeError instanceof AlreadyChargedError) {
        charged = true;
      } else {
        throw chargeError;
      }
    }

    const input = job.input as unknown as StoryArchitectInput;
    const output = await runStoryArchitect(router, input);

    await prisma.$transaction(async (tx) => {
      await tx.storyBible.update({
        where: { projectId: job.projectId },
        data: {
          logline: output.logline,
          premise: output.premise,
          theme: output.theme,
          world: output.world,
          storyRules: output.storyRules,
          episodeStructure: output.episodeStructure as unknown as object,
          status: "READY",
        },
      });

      for (const beat of output.episodeStructure) {
        await tx.episode.upsert({
          where: { projectId_number: { projectId: job.projectId, number: beat.number } },
          create: { projectId: job.projectId, number: beat.number, title: beat.title, synopsis: beat.synopsis, status: "DRAFT" },
          update: { title: beat.title, synopsis: beat.synopsis },
        });
      }

      await tx.project.update({ where: { id: job.projectId }, data: { status: "DRAFT" } });
    });

    await transitionGenerationJob(job.id, "FINALIZING");
    await transitionGenerationJob(job.id, "SUCCEEDED");
  } catch (error) {
    if (charged) {
      await prisma
        .$transaction((tx) =>
          refundGenerationCharge(tx, { userId: job.userId, doeAmount, referenceType: "GenerationJob", referenceId: job.id }),
        )
        .catch((refundError) => console.error(`[storyGenerationService] failed to refund generation charge for job ${job.id}:`, refundError));
    }
    const message = humanReadableError(error);
    await prisma.storyBible.update({ where: { projectId: job.projectId }, data: { status: "DRAFT" } }).catch(() => undefined);
    await prisma.project.update({ where: { id: job.projectId }, data: { status: "DRAFT" } }).catch(() => undefined);
    await transitionGenerationJob(job.id, "FAILED", { errorMessage: message, attempts: { increment: 1 } });
    throw error;
  }
}

function humanReadableError(error: unknown): string {
  if (error instanceof InsufficientGenerationDoeError) {
    return error.message;
  }
  if (error instanceof ProviderNotConfiguredError) {
    return "Story generation isn't available yet — no language model provider is configured. Add an AI provider API key in Settings.";
  }
  if (error instanceof ProviderGenerationError) {
    return "We couldn't generate this story right now. The AI provider had trouble responding — your project is safe, and you can try again.";
  }
  if (error instanceof Error) {
    return `We couldn't generate this story: ${error.message}`;
  }
  return "We couldn't generate this story due to an unexpected error. Your project is safe.";
}
