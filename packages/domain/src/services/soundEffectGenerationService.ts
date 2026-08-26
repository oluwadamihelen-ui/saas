import { randomUUID } from "node:crypto";
import { prisma, chargeForGeneration, refundGenerationCharge, InsufficientGenerationDoeError, AlreadyChargedError } from "@cinerra/database";
import type { ModelRouter } from "@cinerra/ai";
import { ProviderGenerationError, ProviderNotConfiguredError } from "@cinerra/ai";
import type { StorageClient } from "@cinerra/storage";
import { buildAssetKey } from "@cinerra/storage";
import { beginProcessing, transitionGenerationJob, JobCancelledError } from "./jobTransitions.js";

export interface StartSoundEffectGenerationParams {
  userId: string;
  shotId: string;
  enqueue: (generationJobId: string) => Promise<void>;
}

/**
 * Sound effect generation: synthesizes an ambient/action sound cue for a
 * shot from its action description (e.g. "footsteps echo down the
 * corridor" -> a footsteps-on-stone cue). Independent of dialogue — a shot
 * can carry both a spoken line and an action sound effect.
 */
export async function startSoundEffectGeneration(params: StartSoundEffectGenerationParams): Promise<{ generationJobId: string }> {
  const shot = await prisma.shot.findUniqueOrThrow({
    where: { id: params.shotId },
    include: { scene: { include: { project: true } } },
  });
  if (shot.scene.project.ownerId !== params.userId) throw new Error("You do not have access to this shot.");
  if (!shot.action?.trim()) throw new Error("This shot has no action description to generate a sound effect from.");

  const job = await prisma.generationJob.create({
    data: {
      userId: params.userId,
      projectId: shot.scene.projectId,
      shotId: shot.id,
      type: "SOUND_EFFECT",
      status: "QUEUED",
      input: {},
    },
  });
  await params.enqueue(job.id);
  return { generationJobId: job.id };
}

export async function runSoundEffectGenerationJob(router: ModelRouter, storage: StorageClient, generationJobId: string): Promise<void> {
  const job = await prisma.generationJob.findUniqueOrThrow({ where: { id: generationJobId } });
  if (!job.shotId) throw new Error("Sound effect generation job is missing its shot reference.");

  try {
    await beginProcessing(job.id);
  } catch (error) {
    if (error instanceof JobCancelledError) return;
    throw error;
  }

  let charged = false;
  let doeAmount = 0;

  try {
    const shot = await prisma.shot.findUniqueOrThrow({ where: { id: job.shotId } });
    if (!shot.action?.trim()) throw new Error("This shot has no action description to generate a sound effect from.");

    const platformSettings = await prisma.platformSettings.findUniqueOrThrow({ where: { id: "singleton" } });
    doeAmount = platformSettings.doeCostPerAudioSecond * shot.durationSeconds;
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
    const result = await router.execute("SOUND_EFFECT", "BEST_QUALITY", (provider) =>
      provider.generateSoundEffect({ prompt: shot.action!, durationSeconds: shot.durationSeconds }),
    );

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
      data: { projectId: job.projectId, type: "SFX", assetId: asset.id, text: shot.action },
    });

    // Deterministic id keeps this idempotent across regenerations, same
    // pattern as dialogue's timeline placement.
    await prisma.timelineItem.upsert({
      where: { id: `${shot.id}-sfx` },
      create: {
        id: `${shot.id}-sfx`,
        projectId: job.projectId,
        track: "SFX",
        shotId: shot.id,
        audioItemId: audioItem.id,
        startSeconds: 0,
        endSeconds: shot.durationSeconds,
      },
      update: { audioItemId: audioItem.id, endSeconds: shot.durationSeconds },
    });

    await transitionGenerationJob(job.id, "SUCCEEDED");
  } catch (error) {
    if (charged) {
      await prisma
        .$transaction((tx) =>
          refundGenerationCharge(tx, { userId: job.userId, doeAmount, referenceType: "GenerationJob", referenceId: job.id }),
        )
        .catch((refundError) => console.error(`[soundEffectGenerationService] failed to refund generation charge for job ${job.id}:`, refundError));
    }
    const message =
      error instanceof InsufficientGenerationDoeError
        ? error.message
        : error instanceof ProviderNotConfiguredError
          ? "Sound effect generation isn't available yet — no sound effect provider is configured. Add an AI provider API key in Settings."
          : error instanceof ProviderGenerationError
            ? "We couldn't generate this sound effect right now. Your project is safe — try again shortly."
            : `We couldn't generate this sound effect: ${error instanceof Error ? error.message : "unexpected error"}`;
    await transitionGenerationJob(job.id, "FAILED", { errorMessage: message, attempts: { increment: 1 } });
    throw error;
  }
}
