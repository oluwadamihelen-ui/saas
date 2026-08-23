import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { prisma } from "@/server/db/client";
import { getStorageProvider } from "@/server/storage";
import { applyCreditDelta, InsufficientCreditsError } from "@/server/credits/ledger";
import { CREDIT_COSTS } from "@/lib/plans";
import type { AspectRatio, RenderResolution } from "@/generated/prisma/enums";
import type { RenderInputProps } from "@/remotion/types";

const FPS = 30;
const CHROME_EXECUTABLE = process.env.REMOTION_BROWSER_EXECUTABLE || undefined;

const DIMENSIONS: Record<AspectRatio, Record<RenderResolution, { width: number; height: number }>> = {
  RATIO_16_9: { R_720P: { width: 1280, height: 720 }, R_1080P: { width: 1920, height: 1080 } },
  RATIO_9_16: { R_720P: { width: 720, height: 1280 }, R_1080P: { width: 1080, height: 1920 } },
  RATIO_1_1: { R_720P: { width: 720, height: 720 }, R_1080P: { width: 1080, height: 1080 } },
};

let cachedBundleUrl: string | null = null;

async function getBundleUrl(): Promise<string> {
  if (cachedBundleUrl) return cachedBundleUrl;
  cachedBundleUrl = await bundle({ entryPoint: path.join(process.cwd(), "src/remotion/entry.tsx") });
  return cachedBundleUrl;
}

function absoluteUrl(url: string): string {
  if (url.startsWith("http")) return url;
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base}${url}`;
}

export async function runRenderProject(renderJobId: string) {
  const job = await prisma.renderJob.findUniqueOrThrow({ where: { id: renderJobId } });

  async function setStage(stage: string, progress: number) {
    await prisma.renderJob.update({ where: { id: renderJobId }, data: { stage, progress, status: "PROCESSING" } });
  }

  try {
    await setStage("Preparing render", 5);

    const project = await prisma.project.findUniqueOrThrow({
      where: { id: job.projectId },
      include: {
        scenes: { orderBy: { order: "asc" }, include: { captions: { orderBy: { order: "asc" } } } },
        music: { include: { musicTrack: true } },
      },
    });

    if (project.scenes.length === 0) {
      throw new Error("This project has no scenes to render.");
    }
    if (project.scenes.some((s) => !s.imageUrl)) {
      throw new Error("Every scene needs a generated image before you can render.");
    }

    await applyCreditDelta(project.userId, -CREDIT_COSTS.RENDER, "RENDER", { projectId: project.id });

    const dims = DIMENSIONS[project.aspectRatio][job.resolution];
    const music = project.music[0];

    const inputProps: RenderInputProps = {
      fps: FPS,
      width: dims.width,
      height: dims.height,
      scenes: project.scenes.map((s) => ({
        imageUrl: absoluteUrl(s.imageUrl!),
        durationInFrames: Math.max(1, Math.round((s.voiceDurationSeconds ?? s.durationSeconds) * FPS)),
        voiceUrl: s.voiceUrl ? absoluteUrl(s.voiceUrl) : null,
        captions: s.captions.map((c) => ({ text: c.text, startMs: c.startMs, endMs: c.endMs })),
      })),
      music:
        music && music.musicTrack.url
          ? {
              url: absoluteUrl(music.musicTrack.url),
              volume: music.volume,
              fadeInMs: music.fadeInMs,
              fadeOutMs: music.fadeOutMs,
              loop: music.loop,
              duckUnderVoice: music.duckUnderVoice,
            }
          : null,
    };

    await setStage("Rendering scenes", 15);
    const serveUrl = await getBundleUrl();

    const composition = await selectComposition({
      serveUrl,
      id: "story-video",
      inputProps,
      browserExecutable: CHROME_EXECUTABLE,
      chromeMode: CHROME_EXECUTABLE ? "chrome-for-testing" : "headless-shell",
    });

    const tmpOutput = path.join(os.tmpdir(), `render-${renderJobId}.mp4`);

    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: tmpOutput,
      inputProps,
      browserExecutable: CHROME_EXECUTABLE,
      chromeMode: CHROME_EXECUTABLE ? "chrome-for-testing" : "headless-shell",
      onProgress: ({ progress }) => {
        let stage: string;
        let pct: number;
        if (progress < 0.6) {
          stage = "Rendering scenes";
          pct = 15 + Math.round((progress / 0.6) * 45);
        } else if (progress < 0.8) {
          stage = "Mixing audio";
          pct = 60 + Math.round(((progress - 0.6) / 0.2) * 15);
        } else {
          stage = "Encoding video";
          pct = 75 + Math.round(((progress - 0.8) / 0.2) * 15);
        }
        prisma.renderJob.update({ where: { id: renderJobId }, data: { stage, progress: pct } }).catch(() => undefined);
      },
    });

    await setStage("Finalizing", 90);

    const fileBuffer = await fs.readFile(tmpOutput);
    const { url } = await getStorageProvider().put({
      category: "video",
      filename: `project-${project.id}-render.mp4`,
      data: fileBuffer,
      contentType: "video/mp4",
    });
    await fs.unlink(tmpOutput).catch(() => undefined);

    await prisma.renderJob.update({
      where: { id: renderJobId },
      data: { status: "COMPLETED", progress: 100, stage: "Finalizing", outputUrl: url, completedAt: new Date() },
    });
    await prisma.project.update({ where: { id: project.id }, data: { status: "COMPLETED", finalVideoUrl: url } });

    return { url };
  } catch (err) {
    await prisma.renderJob.update({
      where: { id: renderJobId },
      data: {
        status: "FAILED",
        error: err instanceof InsufficientCreditsError ? "Not enough credits." : errorMessage(err),
        completedAt: new Date(),
      },
    });
    throw err;
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}
