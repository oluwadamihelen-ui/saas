import { randomUUID } from "node:crypto";
import { prisma } from "@cinerra/database";
import type { ModelRouter } from "@cinerra/ai";
import { ProviderGenerationError, ProviderNotConfiguredError } from "@cinerra/ai";
import type { StorageClient } from "@cinerra/storage";
import { buildAssetKey } from "@cinerra/storage";
import { compileShotPrompt } from "../promptCompiler.js";
import { resolveShotPromptContext, resolveShotReferenceImages } from "../continuityEngine.js";
import { runShotQualityControl } from "./qualityControlService.js";
import { beginProcessing, transitionGenerationJob, JobCancelledError } from "./jobTransitions.js";

export interface StartShotGenerationParams {
  userId: string;
  shotId: string;
  enqueue: (generationJobId: string) => Promise<void>;
}

/** Kicks off video generation for one shot (spec §24, §57 "Generate"/"Regenerate"). */
export async function startShotGeneration(params: StartShotGenerationParams): Promise<{ generationJobId: string }> {
  const shot = await prisma.shot.findUniqueOrThrow({ where: { id: params.shotId }, include: { scene: { include: { project: true } } } });
  if (shot.scene.project.ownerId !== params.userId) throw new Error("You do not have access to this shot.");

  const job = await prisma.generationJob.create({
    data: {
      userId: params.userId,
      projectId: shot.scene.projectId,
      shotId: shot.id,
      type: "SHOT_VIDEO",
      status: "QUEUED",
      input: {},
    },
  });

  await prisma.shot.update({ where: { id: shot.id }, data: { status: "QUEUED" } });
  await params.enqueue(job.id);
  return { generationJobId: job.id };
}

/**
 * Executed by the worker: compiles the continuity-aware prompt (spec §20-22)
 * and generates the actual shot video. Every provider result is downloaded
 * and re-persisted to durable storage before the shot is ever marked ready
 * — providers' URLs are typically short-lived and are never served to
 * users directly (spec §24, §40).
 *
 * Includes an automated QC pass (spec §27) at the VALIDATING step: a few
 * frames from the generated video are sampled and checked by a
 * vision-capable model for visible artifacts (distorted anatomy, a
 * synthetic look, watermarks, etc — the same list the prompt compiler
 * already asks the video model to avoid). QC is a signal on top of a
 * successful generation, not a gate on it: if IMAGE_ANALYSIS isn't
 * configured, or the QC pass itself fails for any infrastructure reason,
 * the shot still completes and is marked READY — only a QC pass that
 * actually ran and found a problem marks the shot NEEDS_REVISION instead.
 */
export async function runShotGenerationJob(router: ModelRouter, storage: StorageClient, generationJobId: string): Promise<void> {
  const job = await prisma.generationJob.findUniqueOrThrow({ where: { id: generationJobId } });
  if (!job.shotId) throw new Error("Shot generation job is missing its shot reference.");

  try {
    await beginProcessing(job.id);
  } catch (error) {
    if (error instanceof JobCancelledError) return;
    throw error;
  }
  await prisma.shot.update({ where: { id: job.shotId }, data: { status: "GENERATING" } });

  try {
    const context = await resolveShotPromptContext(job.shotId);
    const referenceImages = await resolveShotReferenceImages(job.shotId, (key) => storage.getSignedDownloadUrl(key, 3600));
    const compiled = compileShotPrompt(context);

    await transitionGenerationJob(job.id, "PROVIDER_GENERATING");

    const hasReferences = referenceImages.length > 0;
    const capability = hasReferences ? "IMAGE_TO_VIDEO" : "VIDEO";
    const result = await router.execute(capability, "BEST_QUALITY", (provider) =>
      hasReferences
        ? provider.generateImageToVideo({
            prompt: compiled.prompt,
            negativePrompt: compiled.negativePrompt,
            referenceImages,
            sourceImageUrl: referenceImages[0]!.url,
            durationSeconds: context.shot.durationSeconds,
            aspectRatio: context.aspectRatio,
          })
        : provider.generateVideo({
            prompt: compiled.prompt,
            negativePrompt: compiled.negativePrompt,
            referenceImages,
            durationSeconds: context.shot.durationSeconds,
            aspectRatio: context.aspectRatio,
          }),
    );

    await transitionGenerationJob(job.id, "DOWNLOADING");
    const assetKey = buildAssetKey({ projectId: job.projectId, kind: "GENERATED_VIDEO", assetId: randomUUID(), ext: "mp4" });
    await storage.downloadAndStore(result.providerUrl, assetKey, "video/mp4");

    await transitionGenerationJob(job.id, "VALIDATING");
    let qcReport: Awaited<ReturnType<typeof runShotQualityControl>> = null;
    try {
      qcReport = await runShotQualityControl(router, storage, assetKey, context.shot.durationSeconds);
    } catch (qcError) {
      // A QC infrastructure failure (download, ffmpeg, a malformed model
      // response) must never invalidate an otherwise-successful shot.
      console.error(`[shotGenerationService] QC pass failed to run for shot ${job.shotId}:`, qcError instanceof Error ? qcError.message : qcError);
    }

    await transitionGenerationJob(job.id, "FINALIZING");
    const asset = await prisma.asset.create({
      data: {
        projectId: job.projectId,
        type: "VIDEO",
        kind: "GENERATED_VIDEO",
        storageKey: assetKey,
        mimeType: "video/mp4",
        durationSeconds: context.shot.durationSeconds,
        sourceProvider: result.meta.provider,
        sourceModel: result.meta.modelId,
      },
    });

    await prisma.shot.update({
      where: { id: job.shotId },
      data: {
        status: qcReport && qcReport.score < 1 ? "NEEDS_REVISION" : "READY",
        videoAssetId: asset.id,
        generationPrompt: compiled.prompt,
        negativePrompt: compiled.negativePrompt,
        ...(qcReport ? { qualityScore: qcReport.score, qcNotes: qcReport.frames as unknown as object } : {}),
      },
    });

    await transitionGenerationJob(job.id, "SUCCEEDED");
  } catch (error) {
    const message =
      error instanceof ProviderNotConfiguredError
        ? "Video generation isn't available yet — no video provider is configured. Add an AI provider API key in Settings."
        : error instanceof ProviderGenerationError
          ? "We couldn't generate this shot. The video provider had trouble responding — your project is safe, and you can retry."
          : `We couldn't generate this shot: ${error instanceof Error ? error.message : "unexpected error"}`;

    await prisma.shot.update({ where: { id: job.shotId }, data: { status: "FAILED" } }).catch(() => undefined);
    await transitionGenerationJob(job.id, "FAILED", { errorMessage: message, attempts: { increment: 1 } });
    throw error;
  }
}
