import type { VoiceProvider, GeneratedAsset } from "../types";
import { encodeWav, toneSamples, sequenceSamples } from "./wav";

const STYLE_BASE_FREQUENCY: Record<string, number> = {
  WARM: 200,
  ENERGETIC: 320,
  DRAMATIC: 160,
  PROFESSIONAL: 220,
  EDUCATIONAL: 240,
  FRIENDLY: 260,
  STORYTELLING: 210,
};

const WORDS_PER_MINUTE = 150;

/**
 * Produces a real, audible WAV file — a sequence of short tones whose count
 * and pacing roughly track the narration's word count and requested speed.
 * This is NOT synthesized speech; it's an honest audible placeholder so the
 * narration pipeline (generate -> store -> play in the editor) can be built
 * and tested without a TTS API key. Swap in a real VoiceProvider later.
 */
export class MockVoiceProvider implements VoiceProvider {
  readonly name = "mock";
  readonly isMock = true;

  async synthesize(input: {
    text: string;
    style: string;
    language: string;
    accent?: string;
    speed: number;
    pitch: number;
  }): Promise<GeneratedAsset & { durationSeconds: number }> {
    const words = input.text.trim().split(/\s+/).filter(Boolean);
    const wordCount = Math.max(words.length, 1);

    const baseFreq = (STYLE_BASE_FREQUENCY[input.style] ?? 220) * clamp(input.pitch, 0.5, 2);
    const wpm = WORDS_PER_MINUTE * clamp(input.speed, 0.5, 2);
    const secondsPerWord = 60 / wpm;

    // Group words into syllable-like blips (~1.6 words per blip) rather than
    // one blip per word, so short scenes still sound like short phrases.
    const blipCount = Math.max(1, Math.round(wordCount / 1.6));
    const blipDuration = Math.max(0.08, secondsPerWord * 1.4);

    const segments = Array.from({ length: blipCount }, (_, i) =>
      toneSamples({
        durationSeconds: blipDuration,
        frequencyHz: baseFreq * (1 + 0.08 * Math.sin(i)), // slight pitch variation per blip
        amplitude: 0.25,
      })
    );

    const samples = sequenceSamples(segments, 0.04);
    const durationSeconds = samples.length / 22050;

    return { buffer: encodeWav(samples), contentType: "audio/wav", durationSeconds };
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
