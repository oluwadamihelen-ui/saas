import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prisma } from "@cinerra/database";
import type { StorageClient } from "@cinerra/storage";
import { buildAssetKey } from "@cinerra/storage";
import { concatVideos, FfmpegExecutionError, FfmpegNotAvailableError } from "@cinerra/media";
import { checkEpisodeExportReadiness } from "../exportReadiness.js";
import { resolveTargetSize } from "../lib/exportResolution.js";
import { prepareShotSegments, overlayEpisodeMusicIfAny } from "./shotAssembly.js";
import { beginProcessing, transitionGenerationJob, JobCancelledError } from "./jobTransitions.js";

export interface StartEpisodeExportParams {
  userId: string;
  episodeId: string;
  resolution: "720p" | "1080p" | "4K";
  enqueue: (generationJobId: string) => Promise<void>;
}

/**
 * Episode assembly/export (spec §31, §65): concatenates every shot's
 * generated video, in scene/shot order, muxing in each shot's dialogue
 * and sound-effect audio together (or silence, so every segment has a
 * matching audio track), then overlays the episode's background score
 * across the whole thing if one has been generated — the lightweight
 * timeline assembly this codebase implements today, ahead of a full
 * drag-and-drop timeline editor.
 */
export async function startEpisodeExport(params: StartEpisodeExportParams): Promise<{ generationJobId: string; exportId: string }> {
  const episode = await prisma.episode.findUniqueOrThrow({ where: { id: params.episodeId }, include: { project: true } });
  if (episode.project.ownerId !== params.userId) throw new Error("You do not have access to this episode.");

  const shots = await prisma.shot.findMany({ where: { scene: { episodeId: episode.id } }, select: { status: true } });
  const readiness = checkEpisodeExportReadiness(shots);
  if (!readiness.ready) throw new Error(readiness.reason);

  const exportRow = await prisma.export.create({
    data: {
      projectId: episode.projectId,
      episodeId: episode.id,
      format: "MP4",
      resolution: params.resolution,
      aspectRatio: episode.project.aspectRatio,
      status: "QUEUED",
    },
  });

  const job = await prisma.generationJob.create({
    data: {
      userId: params.userId,
      projectId: episode.projectId,
      type: "EXPORT",
      status: "QUEUED",
      input: { episodeId: episode.id, exportId: exportRow.id },
    },
  });

  await params.enqueue(job.id);
  return { generationJobId: job.id, exportId: exportRow.id };
}

export async function runEpisodeExportJob(storage: StorageClient, generationJobId: string): Promise<void> {
  const job = await prisma.generationJob.findUniqueOrThrow({ where: { id: generationJobId } });

  try {
    await beginProcessing(job.id);
  } catch (error) {
    if (error instanceof JobCancelledError) return;
    throw error;
  }

  const { episodeId, exportId } = job.input as { episodeId: string; exportId: string };
  let workDir: string | undefined;

  try {
    const exportRow = await prisma.export.findUniqueOrThrow({ where: { id: exportId } });
    const targetSize = resolveTargetSize(exportRow.resolution as "720p" | "1080p" | "4K", exportRow.aspectRatio);

    const scenes = await prisma.scene.findMany({
      where: { episodeId },
      orderBy: { number: "asc" },
      include: {
        shots: {
          orderBy: { order: "asc" },
          include: {
            videoAsset: true,
            timelineItems: { where: { track: { in: ["DIALOGUE", "SFX"] } }, include: { audioItem: { include: { asset: true } } } },
          },
        },
      },
    });
    const allShots = scenes.flatMap((s) => s.shots);
    const readiness = checkEpisodeExportReadiness(allShots);
    if (!readiness.ready) throw new Error(readiness.reason);

    await transitionGenerationJob(job.id, "DOWNLOADING");
    workDir = await mkdtemp(join(tmpdir(), "cinerra-export-"));
    const preparedSegments = await prepareShotSegments(storage, workDir, allShots);

    await transitionGenerationJob(job.id, "FINALIZING");
    const concatenatedPath = join(workDir, "concatenated.mp4");
    await concatVideos(preparedSegments, concatenatedPath, targetSize);
    const finalPath = await overlayEpisodeMusicIfAny(storage, workDir, episodeId, concatenatedPath);

    const finalBytes = await readFile(finalPath);
    const assetKey = buildAssetKey({ projectId: job.projectId, kind: "EXPORT", assetId: randomUUID(), ext: "mp4" });
    await storage.putObject(assetKey, finalBytes, "video/mp4");

    await prisma.export.update({ where: { id: exportId }, data: { status: "SUCCEEDED", assetKey } });
    await transitionGenerationJob(job.id, "SUCCEEDED");
  } catch (error) {
    const message =
      error instanceof FfmpegNotAvailableError
        ? error.message
        : error instanceof FfmpegExecutionError
          ? "We couldn't assemble this episode — FFmpeg failed while processing the video. Your project is safe."
          : `We couldn't export this episode: ${error instanceof Error ? error.message : "unexpected error"}`;

    await prisma.export.update({ where: { id: exportId }, data: { status: "FAILED", errorMessage: message } }).catch(() => undefined);
    await transitionGenerationJob(job.id, "FAILED", { errorMessage: message, attempts: { increment: 1 } });
    throw error;
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
