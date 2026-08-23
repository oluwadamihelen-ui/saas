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
import { selectClipShots } from "../lib/clipSelection.js";
import { prepareShotSegments, overlayEpisodeMusicIfAny } from "./shotAssembly.js";
import { beginProcessing, transitionGenerationJob, JobCancelledError } from "./jobTransitions.js";

export type ClipKind = "TRAILER" | "SOCIAL_CLIP";

// Deliberately short and fixed rather than user-configurable — these are
// lightweight promo cuts, not the deliverable itself. A trailer keeps the
// project's own aspect ratio and runs up to a minute; a social clip is
// forced to the standard vertical short-form ratio and capped much
// shorter, regardless of what the project's own format is.
const TARGET_DURATION_SECONDS: Record<ClipKind, number> = { TRAILER: 60, SOCIAL_CLIP: 20 };
const CLIP_RESOLUTION = "720p" as const;

export interface StartClipGenerationParams {
  userId: string;
  episodeId: string;
  kind: ClipKind;
  enqueue: (generationJobId: string) => Promise<void>;
}

/**
 * Selects candidate shots for a clip (one representative shot per scene —
 * the first shot, in scene order — capped to the kind's target duration)
 * and checks that exactly those shots are ready. Deliberately more
 * lenient than full episode export: a trailer only needs the shots it
 * will actually use, not every shot in the episode, so it can be
 * generated as a preview while the rest of the episode is still in
 * progress.
 */
async function selectCandidates(episodeId: string, kind: ClipKind) {
  const scenes = await prisma.scene.findMany({
    where: { episodeId },
    orderBy: { number: "asc" },
    include: { shots: { orderBy: { order: "asc" }, take: 1 } },
  });
  const perSceneFirstShots = scenes.map((s) => s.shots[0]).filter((s): s is NonNullable<typeof s> => Boolean(s));
  return selectClipShots(perSceneFirstShots, TARGET_DURATION_SECONDS[kind]);
}

/**
 * Trailer/social clip generation (spec §65 "next phase" roadmap): a
 * deterministic highlight cut assembled from real, already-generated
 * shots — never an AI-invented "best moments" claim, just one
 * representative shot per scene, in story order, up to a target length.
 * Shares its FFmpeg assembly (per-shot mux, concat, optional score
 * overlay) with the full episode export in shotAssembly.ts.
 */
export async function startClipGeneration(params: StartClipGenerationParams): Promise<{ generationJobId: string; exportId: string }> {
  const episode = await prisma.episode.findUniqueOrThrow({ where: { id: params.episodeId }, include: { project: true } });
  if (episode.project.ownerId !== params.userId) throw new Error("You do not have access to this episode.");

  const candidates = await selectCandidates(episode.id, params.kind);
  const readiness = checkEpisodeExportReadiness(candidates);
  if (!readiness.ready) throw new Error(readiness.reason);

  const exportRow = await prisma.export.create({
    data: {
      projectId: episode.projectId,
      episodeId: episode.id,
      kind: params.kind,
      format: "MP4",
      resolution: CLIP_RESOLUTION,
      aspectRatio: params.kind === "SOCIAL_CLIP" ? "PORTRAIT_9_16" : episode.project.aspectRatio,
      status: "QUEUED",
    },
  });

  const job = await prisma.generationJob.create({
    data: {
      userId: params.userId,
      projectId: episode.projectId,
      type: params.kind,
      status: "QUEUED",
      input: { episodeId: episode.id, exportId: exportRow.id, kind: params.kind },
    },
  });

  await params.enqueue(job.id);
  return { generationJobId: job.id, exportId: exportRow.id };
}

export async function runClipGenerationJob(storage: StorageClient, generationJobId: string): Promise<void> {
  const job = await prisma.generationJob.findUniqueOrThrow({ where: { id: generationJobId } });

  try {
    await beginProcessing(job.id);
  } catch (error) {
    if (error instanceof JobCancelledError) return;
    throw error;
  }

  const { episodeId, exportId, kind } = job.input as { episodeId: string; exportId: string; kind: ClipKind };
  let workDir: string | undefined;

  try {
    const exportRow = await prisma.export.findUniqueOrThrow({ where: { id: exportId } });
    const targetSize = resolveTargetSize(CLIP_RESOLUTION, exportRow.aspectRatio);

    const candidateShots = await selectCandidates(episodeId, kind);
    const readiness = checkEpisodeExportReadiness(candidateShots);
    if (!readiness.ready) throw new Error(readiness.reason);

    const selectedShots = await prisma.shot.findMany({
      where: { id: { in: candidateShots.map((s) => s.id) } },
      include: {
        videoAsset: true,
        timelineItems: { where: { track: { in: ["DIALOGUE", "SFX"] } }, include: { audioItem: { include: { asset: true } } } },
      },
    });
    // Re-order to match the candidate selection (Prisma's `in` filter doesn't preserve input order).
    const orderedShots = candidateShots.map((c) => selectedShots.find((s) => s.id === c.id)!);

    await transitionGenerationJob(job.id, "DOWNLOADING");
    workDir = await mkdtemp(join(tmpdir(), "cinerra-clip-"));
    const preparedSegments = await prepareShotSegments(storage, workDir, orderedShots);

    await transitionGenerationJob(job.id, "FINALIZING");
    const concatenatedPath = join(workDir, "concatenated.mp4");
    await concatVideos(preparedSegments, concatenatedPath, targetSize);
    const finalPath = await overlayEpisodeMusicIfAny(storage, workDir, episodeId, concatenatedPath);

    const finalBytes = await readFile(finalPath);
    const assetKey = buildAssetKey({ projectId: job.projectId, kind: "EXPORT", assetId: randomUUID(), ext: "mp4" });
    await storage.putObject(assetKey, finalBytes, "video/mp4");

    await prisma.export.update({
      where: { id: exportId },
      data: { status: "SUCCEEDED", assetKey, clipShotIds: orderedShots.map((s) => s.id) },
    });
    await transitionGenerationJob(job.id, "SUCCEEDED");
  } catch (error) {
    const kindLabel = kind === "TRAILER" ? "trailer" : "social clip";
    const message =
      error instanceof FfmpegNotAvailableError
        ? error.message
        : error instanceof FfmpegExecutionError
          ? `We couldn't assemble this ${kindLabel} — FFmpeg failed while processing the video. Your project is safe.`
          : `We couldn't generate this ${kindLabel}: ${error instanceof Error ? error.message : "unexpected error"}`;

    await prisma.export.update({ where: { id: exportId }, data: { status: "FAILED", errorMessage: message } }).catch(() => undefined);
    await transitionGenerationJob(job.id, "FAILED", { errorMessage: message, attempts: { increment: 1 } });
    throw error;
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
