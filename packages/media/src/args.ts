/**
 * Pure ffmpeg argument builders, kept separate from process execution so
 * they're unit-testable without actually invoking ffmpeg.
 */

/**
 * Attaches a dialogue audio track to a video, replacing whatever audio the
 * source clip already has (a provider-generated shot may have none, or
 * ambient sound we don't want to keep for this MVP). `-shortest` trims to
 * the shorter of the two so mismatched durations don't leave dead air or
 * a frozen last frame.
 */
export function buildMuxAudioArgs(videoPath: string, audioPath: string, outputPath: string): string[] {
  return ["-y", "-i", videoPath, "-i", audioPath, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-shortest", outputPath];
}

/**
 * Adds a silent audio track to a video that has none. The concat filter
 * below requires every input to have both a video and an audio stream —
 * a shot with no dialogue would otherwise be silent-video-only and break
 * the concat filtergraph, so every segment is normalized to have *some*
 * audio track (silent or real) before concatenation.
 */
export function buildAddSilentAudioArgs(videoPath: string, outputPath: string): string[] {
  return [
    "-y",
    "-i",
    videoPath,
    "-f",
    "lavfi",
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-shortest",
    outputPath,
  ];
}

export interface TargetSize {
  width: number;
  height: number;
}

/**
 * Scales to fit within the target box preserving aspect ratio, then pads
 * to exactly fill it — so the requested export resolution (spec §65) is
 * an actual property of the output file, not just a label validated
 * against the plan and otherwise ignored.
 */
function scalePadFilter(target: TargetSize): string {
  return `scale=${target.width}:${target.height}:force_original_aspect_ratio=decrease,pad=${target.width}:${target.height}:(ow-iw)/2:(oh-ih)/2,setsar=1`;
}

/**
 * Concatenates N video files into one, re-encoding via the concat filter
 * (robust to the inputs having slightly different codecs/parameters,
 * unlike the concat demuxer which requires identical streams). Optionally
 * scales+pads the combined output to an exact target resolution.
 */
export function buildConcatArgs(inputPaths: string[], outputPath: string, targetSize?: TargetSize): string[] {
  if (inputPaths.length === 0) {
    throw new Error("buildConcatArgs requires at least one input.");
  }

  if (inputPaths.length === 1) {
    if (!targetSize) {
      // Nothing to concatenate and no scaling requested — just re-mux/copy.
      return ["-y", "-i", inputPaths[0]!, "-c", "copy", outputPath];
    }
    return ["-y", "-i", inputPaths[0]!, "-vf", scalePadFilter(targetSize), "-c:v", "libx264", "-c:a", "aac", outputPath];
  }

  const inputArgs = inputPaths.flatMap((p) => ["-i", p]);
  const streamRefs = inputPaths.map((_, i) => `[${i}:v:0][${i}:a:0]`).join("");
  const filter = targetSize
    ? `${streamRefs}concat=n=${inputPaths.length}:v=1:a=1[cv][outa];[cv]${scalePadFilter(targetSize)}[outv]`
    : `${streamRefs}concat=n=${inputPaths.length}:v=1:a=1[outv][outa]`;

  return ["-y", ...inputArgs, "-filter_complex", filter, "-map", "[outv]", "-map", "[outa]", "-c:v", "libx264", "-c:a", "aac", outputPath];
}
