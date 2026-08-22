import { spawn } from "node:child_process";
import { FfmpegExecutionError, FfmpegNotAvailableError } from "./errors.js";
import { buildAddSilentAudioArgs, buildConcatArgs, buildMuxAudioArgs, type TargetSize } from "./args.js";

let availabilityCache: boolean | null = null;

/** Checks once per process whether the `ffmpeg` binary is on PATH. */
export async function isFfmpegAvailable(): Promise<boolean> {
  if (availabilityCache !== null) return availabilityCache;
  availabilityCache = await new Promise<boolean>((resolve) => {
    const child = spawn("ffmpeg", ["-version"]);
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
  return availabilityCache;
}

async function runFfmpeg(args: string[]): Promise<void> {
  if (!(await isFfmpegAvailable())) {
    throw new FfmpegNotAvailableError();
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args);
    let stderrTail = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString()).slice(-4000); // keep only the tail for a useful error
    });
    child.on("error", (error) => reject(error));
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new FfmpegExecutionError(`ffmpeg ${args.join(" ")}`, code, stderrTail));
    });
  });
}

/** Replaces a video's audio track with the given dialogue audio (spec §29-31 timeline assembly). */
export async function muxAudioOntoVideo(videoPath: string, audioPath: string, outputPath: string): Promise<void> {
  await runFfmpeg(buildMuxAudioArgs(videoPath, audioPath, outputPath));
}

/** Normalizes a dialogue-less shot so it has a (silent) audio track, matching every other concat input. */
export async function addSilentAudioTrack(videoPath: string, outputPath: string): Promise<void> {
  await runFfmpeg(buildAddSilentAudioArgs(videoPath, outputPath));
}

/** Concatenates prepared shot segments (each already carrying a real or silent audio track) into one episode file, optionally scaled to an exact target resolution. */
export async function concatVideos(inputPaths: string[], outputPath: string, targetSize?: TargetSize): Promise<void> {
  await runFfmpeg(buildConcatArgs(inputPaths, outputPath, targetSize));
}
