import { Audio } from "remotion";
import type { RenderMusic, RenderScene } from "./types";

export function BackgroundMusic({
  music,
  scenes,
  fps,
  totalFrames,
}: {
  music: RenderMusic;
  scenes: RenderScene[];
  fps: number;
  totalFrames: number;
}) {
  const fadeInFrames = Math.max(1, Math.round((music.fadeInMs / 1000) * fps));
  const fadeOutFrames = Math.max(1, Math.round((music.fadeOutMs / 1000) * fps));

  // Precompute each scene's [startFrame, endFrame) so the volume callback
  // can look up whether narration is playing at a given frame (for ducking)
  // without recomputing the offsets on every call.
  const sceneRanges: Array<{ start: number; end: number; hasVoice: boolean }> = [];
  let acc = 0;
  for (const scene of scenes) {
    sceneRanges.push({ start: acc, end: acc + scene.durationInFrames, hasVoice: Boolean(scene.voiceUrl) });
    acc += scene.durationInFrames;
  }

  function volumeAt(frame: number): number {
    const inVoiceScene = sceneRanges.some((r) => frame >= r.start && frame < r.end && r.hasVoice);
    let volume = music.volume * (music.duckUnderVoice && inVoiceScene ? 0.25 : 1);

    if (frame < fadeInFrames) volume *= frame / fadeInFrames;
    const fadeOutStart = totalFrames - fadeOutFrames;
    if (frame > fadeOutStart) volume *= Math.max(0, (totalFrames - frame) / fadeOutFrames);

    return Math.max(0, Math.min(1, volume));
  }

  return <Audio src={music.url} volume={volumeAt} loop={music.loop} />;
}
