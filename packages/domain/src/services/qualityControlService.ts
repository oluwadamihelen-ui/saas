import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ModelRouter } from "@cinerra/ai";
import type { StorageClient } from "@cinerra/storage";
import { extractFrame } from "@cinerra/media";
import { BASE_NEGATIVE_PROMPT_ITEMS } from "../promptCompiler.js";
import { buildQcQuestion, parseQcAnswer, summarizeQcFrames, type QcFrameResult, type QcReport } from "../lib/qualityControl.js";

const FRAME_FRACTIONS = [0.15, 0.5, 0.85]; // near-start, middle, near-end — skips the very first/last frame, which is often a fade

/**
 * Best-effort automated QC pass (spec §27): samples a few frames from the
 * just-generated shot video and asks a vision-capable model to flag
 * visible artifacts — the same list the prompt compiler already asks the
 * video model to avoid (distorted anatomy, a synthetic/plastic look,
 * watermarks, etc).
 *
 * Returns null when IMAGE_ANALYSIS has no configured provider — QC is a
 * signal layered on top of a successful generation, never a gate that
 * blocks one, so a caller should treat null exactly like "no opinion"
 * rather than a failure. Any other error (download, ffmpeg, a malformed
 * model response) propagates so the caller can log it and proceed the
 * same way: a QC infrastructure hiccup must never invalidate an otherwise
 * successful shot.
 */
export async function runShotQualityControl(router: ModelRouter, storage: StorageClient, assetKey: string, durationSeconds: number): Promise<QcReport | null> {
  if (!router.isConfigured("IMAGE_ANALYSIS")) return null;

  let workDir: string | undefined;
  try {
    const url = await storage.getSignedDownloadUrl(assetKey, 3600);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download shot video for QC (${response.status}).`);

    workDir = await mkdtemp(join(tmpdir(), "cinerra-qc-"));
    const videoPath = join(workDir, "shot.mp4");
    await writeFile(videoPath, Buffer.from(await response.arrayBuffer()));

    const question = buildQcQuestion(BASE_NEGATIVE_PROMPT_ITEMS);
    const frames: QcFrameResult[] = [];
    for (const fraction of FRAME_FRACTIONS) {
      const atSeconds = Math.min(Math.max(durationSeconds - 0.1, 0), durationSeconds * fraction);
      const framePath = join(workDir, `frame-${fraction}.jpg`);
      await extractFrame(videoPath, framePath, atSeconds);
      const imageBase64 = (await readFile(framePath)).toString("base64");

      const result = await router.execute("IMAGE_ANALYSIS", "FASTEST", (provider) =>
        provider.analyzeImage({ imageUrl: `data:image/jpeg;base64,${imageBase64}`, question }),
      );
      const { pass, issues } = parseQcAnswer(result.answer);
      frames.push({ atSeconds, pass, issues });
    }

    return summarizeQcFrames(frames);
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
