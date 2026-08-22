/** Thrown when the `ffmpeg` binary isn't on PATH — surfaced as an honest, human-readable message rather than a fake export (spec §39, §81). */
export class FfmpegNotAvailableError extends Error {
  constructor() {
    super("Video export isn't available yet — FFmpeg is not installed on this worker. Install FFmpeg and make sure it's on PATH.");
    this.name = "FfmpegNotAvailableError";
  }
}

/** Thrown when an ffmpeg invocation exits non-zero. */
export class FfmpegExecutionError extends Error {
  constructor(command: string, exitCode: number | null, stderrTail: string) {
    super(`ffmpeg failed (exit ${exitCode ?? "unknown"}) running: ${command}\n${stderrTail}`);
    this.name = "FfmpegExecutionError";
  }
}
