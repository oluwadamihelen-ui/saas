import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prisma } from "@cinerra/database";
import type { StorageClient } from "@cinerra/storage";
import { buildAssetKey } from "@cinerra/storage";
import { concatVideos, FfmpegExecutionError, FfmpegNotAvailableError } from "@cinerra/media";
import type { EmailClient } from "@cinerra/email";
import { exportReadyEmail, exportFailedEmail } from "@cinerra/email";
import { checkEpisodeExportReadiness } from "../exportReadiness.js";
import { resolveTargetSize } from "../lib/exportResolution.js";
import { resolveEpisodeShotOrder } from "../lib/timelineOrder.js";
import { prepareShotSegments, overlayEpisodeMusicIfAny } from "./shotAssembly.js";
import { beginProcessing, transitionGenerationJob, JobCancelledError } from "./jobTransitions.js";

/**
 * Best-effort notification — a failed or unconfigured email provider must
 * never affect the export's own SUCCEEDED/FAILED outcome, so every call
 * site swallows and logs rather than propagating.
 */
async function notifyExportOutcome(
  email: EmailClient,
  appBaseUrl: string,
  episodeId: string,
  projectId: string,
  outcome: { status: "SUCCEEDED" } | { status: "FAILED"; errorMessage: string },
): Promise<void> {
  try {
    const [episode, project] = await Promise.all([
      prisma.episode.findUnique({ where: { id: episodeId }, select: { title: true } }),
      prisma.project.findUnique({ where: { id: projectId }, select: { title: true, owner: { select: { email: true } } } }),
    ]);
    if (!episode || !project) return;

    const projectUrl = `${appBaseUrl}/projects/${projectId}`;
    const content =
      outcome.status === "SUCCEEDED"
        ? exportReadyEmail({ projectTitle: project.title, episodeTitle: episode.title, projectUrl })
        : exportFailedEmail({ projectTitle: project.title, episodeTitle: episode.title, errorMessage: outcome.errorMessage, projectUrl });

    await email.send({ to: project.owner.email, ...content });
  } catch (error) {
    console.error("[email] Failed to send export outcome notification:", error);
  }
}

export interface StartEpisodeExportParams {
  userId: string;
  episodeId: string;
  resolution: "720p" | "1080p" | "4K";
  enqueue: (generationJobId: string) => Promise<void>;
}

/**
 * Episode assembly/export (spec §31, §65): concatenates every shot's
 * generated video — in the timeline editor's manual order once a creator
 * has set one, else natural scene/shot order — muxing in each shot's
 * dialogue and sound-effect audio together (respecting any per-track
 * volume/mute override, or silence if neither track exists), then
 * overlays the episode's background score across the whole thing if one
 * has been generated and isn't muted.
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

export async function runEpisodeExportJob(storage: StorageClient, email: EmailClient, appBaseUrl: string, generationJobId: string): Promise<void> {
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
    const allShots = resolveEpisodeShotOrder(scenes.flatMap((s) => s.shots));
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
    await notifyExportOutcome(email, appBaseUrl, episodeId, job.projectId, { status: "SUCCEEDED" });
  } catch (error) {
    const message =
      error instanceof FfmpegNotAvailableError
        ? error.message
        : error instanceof FfmpegExecutionError
          ? "We couldn't assemble this episode — FFmpeg failed while processing the video. Your project is safe."
          : `We couldn't export this episode: ${error instanceof Error ? error.message : "unexpected error"}`;

    await prisma.export.update({ where: { id: exportId }, data: { status: "FAILED", errorMessage: message } }).catch(() => undefined);
    await transitionGenerationJob(job.id, "FAILED", { errorMessage: message, attempts: { increment: 1 } });
    // A transient failure may still succeed on BullMQ's retry — this can
    // fire once before that happens, which is an accepted, documented
    // rough edge (see README) rather than something worth the complexity
    // of only notifying on final attempt exhaustion.
    await notifyExportOutcome(email, appBaseUrl, episodeId, job.projectId, { status: "FAILED", errorMessage: message });
    throw error;
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
