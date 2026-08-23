import type { MusicProvider, GeneratedAsset } from "../types";
import { encodeWav } from "./wav";

// Each mood maps to a small chord (root, third, fifth in Hz) — a simple,
// honest way to give moods audibly distinct mock previews.
const MOOD_CHORDS: Record<string, number[]> = {
  CINEMATIC: [130.81, 164.81, 196.0], // C major, low
  HAPPY: [261.63, 329.63, 392.0], // C major, bright
  EMOTIONAL: [220.0, 261.63, 329.63], // A minor-ish
  INSPIRATIONAL: [246.94, 311.13, 369.99], // B-ish major
  SUSPENSE: [196.0, 233.08, 277.18], // dissonant-ish
  CALM: [174.61, 220.0, 261.63], // F major, soft
  ADVENTURE: [293.66, 369.99, 440.0], // D major
  CORPORATE: [220.0, 277.18, 329.63], // A major
  CHILDRENS: [329.63, 415.3, 493.88], // E major, playful
};

const SAMPLE_RATE = 22050;

/**
 * Produces a real, audible looping WAV chord as a mood-appropriate mock
 * track — not a real composition. Swap in a real MusicProvider once a
 * music-generation API key is configured.
 */
export class MockMusicProvider implements MusicProvider {
  readonly name = "mock";
  readonly isMock = true;

  async generateTrack(input: { mood: string; durationSeconds: number }): Promise<GeneratedAsset & { durationSeconds: number }> {
    const chord = MOOD_CHORDS[input.mood] ?? MOOD_CHORDS.CALM;
    const duration = clamp(input.durationSeconds, 4, 30);
    const total = Math.round(duration * SAMPLE_RATE);
    const samples = new Float32Array(total);

    const fade = Math.round(SAMPLE_RATE * 0.3);

    for (let i = 0; i < total; i++) {
      const t = i / SAMPLE_RATE;
      let sample = 0;
      for (const freq of chord) {
        sample += Math.sin(2 * Math.PI * freq * t);
      }
      sample /= chord.length;

      // Slow tremolo so the loop feels like a sustained pad rather than a flat drone.
      const tremolo = 0.85 + 0.15 * Math.sin(2 * Math.PI * 0.5 * t);
      let envelope = 1;
      if (i < fade) envelope = i / fade;
      else if (i > total - fade) envelope = (total - i) / fade;

      samples[i] = sample * tremolo * envelope * 0.2;
    }

    return { buffer: encodeWav(samples, SAMPLE_RATE), contentType: "audio/wav", durationSeconds: duration };
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
