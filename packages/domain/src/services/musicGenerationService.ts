import { randomUUID } from "node:crypto";
import { prisma, chargeForGeneration, refundGenerationCharge, InsufficientGenerationDoeError, AlreadyChargedError } from "@cinerra/database";
import type { ModelRouter } from "@cinerra/ai";
import { ProviderGenerationError, ProviderNotConfiguredError } from "@cinerra/ai";
import type { StorageClient } from "@cinerra/storage";
import { buildAssetKey } from "@cinerra/storage";
import { buildMusicPrompt } from "../lib/musicPrompt.js";
import { beginProcessing, transitionGenerationJob, JobCancelledError } from "./jobTransitions.js";

const DEFAULT_SCORE_LENGTH_SECONDS = 90;

export interface StartMusicGenerationParams {
  userId: string;
  episodeId: string;
  enqueue: (generationJobId: string) => Promise<void>;
}

/**
 * Episode background music: one instrumental score per episode, generated
 * from the story bible's genre/tone and the episode's synopsis. Distinct
 * from per-shot dialogue/SFX — this is placed on the timeline against the
 * episode as a whole (TimelineItem.episodeId), not a shot.
 */
export async function startMusicGeneration(params: StartMusicGenerationParams): Promise<{ generationJobId: string }> {
  const episode = await prisma.episode.findUniqueOrThrow({ where: { id: params.episodeId }, include: { project: true } });
  if (episode.project.ownerId !== params.userId) throw new Error("You do not have access to this episode.");

  const job = await prisma.generationJob.create({
    data: {
      userId: params.userId,
      projectId: episode.projectId,
      type: "MUSIC",
      status: "QUEUED",
      input: { episodeId: episode.id },
    },
  });
  await params.enqueue(job.id);
  return { generationJobId: job.id };
}

export async function runMusicGenerationJob(router: ModelRouter, storage: StorageClient, generationJobId: string): Promise<void> {
  const job = await prisma.generationJob.findUniqueOrThrow({ where: { id: generationJobId } });
  const { episodeId } = job.input as { episodeId: string };

  try {
    await beginProcessing(job.id);
  } catch (error) {
    if (error instanceof JobCancelledError) return;
    throw error;
  }

  let charged = false;
  let doeAmount = 0;

  try {
    const episode = await prisma.episode.findUniqueOrThrow({
      where: { id: episodeId },
      include: { project: { include: { storyBible: true } } },
    });
    const durationSeconds = episode.runtimeSeconds ?? DEFAULT_SCORE_LENGTH_SECONDS;
    const prompt = buildMusicPrompt(episode, episode.project.storyBible);
    const mood = episode.project.storyBible?.tones.join(", ");

    const platformSettings = await prisma.platformSettings.findUniqueOrThrow({ where: { id: "singleton" } });
    doeAmount = platformSettings.doeCostPerAudioSecond * durationSeconds;
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

    await transitionGenerationJob(job.id, "PROVIDER_GENERATING");
    const result = await router.execute("MUSIC", "BEST_QUALITY", (provider) => provider.generateMusic({ prompt, durationSeconds, mood }));

    await transitionGenerationJob(job.id, "DOWNLOADING");
    const assetKey = buildAssetKey({ projectId: job.projectId, kind: "GENERATED_AUDIO", assetId: randomUUID(), ext: "mp3" });
    await storage.downloadAndStore(result.providerUrl, assetKey, "audio/mpeg");

    await transitionGenerationJob(job.id, "FINALIZING");
    const asset = await prisma.asset.create({
      data: {
        projectId: job.projectId,
        type: "AUDIO",
        kind: "GENERATED_AUDIO",
        storageKey: assetKey,
        mimeType: "audio/mpeg",
        sourceProvider: result.meta.provider,
        sourceModel: result.meta.modelId,
      },
    });

    const audioItem = await prisma.audioItem.create({
      data: { projectId: job.projectId, type: "MUSIC", assetId: asset.id, text: prompt },
    });

    // Deterministic id keeps this idempotent across regenerations, same
    // pattern used for dialogue/SFX timeline placement.
    await prisma.timelineItem.upsert({
      where: { id: `${episode.id}-music` },
      create: {
        id: `${episode.id}-music`,
        projectId: job.projectId,
        track: "MUSIC",
        episodeId: episode.id,
        audioItemId: audioItem.id,
        startSeconds: 0,
        endSeconds: durationSeconds,
      },
      update: { audioItemId: audioItem.id, endSeconds: durationSeconds },
    });

    await transitionGenerationJob(job.id, "SUCCEEDED");
  } catch (error) {
    if (charged) {
      await prisma
        .$transaction((tx) =>
          refundGenerationCharge(tx, { userId: job.userId, doeAmount, referenceType: "GenerationJob", referenceId: job.id }),
        )
        .catch((refundError) => console.error(`[musicGenerationService] failed to refund generation charge for job ${job.id}:`, refundError));
    }
    const message =
      error instanceof InsufficientGenerationDoeError
        ? error.message
        : error instanceof ProviderNotConfiguredError
          ? "Music generation isn't available yet — no music provider is configured. Add an AI provider API key in Settings."
          : error instanceof ProviderGenerationError
            ? "We couldn't generate this score right now. Your project is safe — try again shortly."
            : `We couldn't generate this episode's score: ${error instanceof Error ? error.message : "unexpected error"}`;
    await transitionGenerationJob(job.id, "FAILED", { errorMessage: message, attempts: { increment: 1 } });
    throw error;
  }
}
