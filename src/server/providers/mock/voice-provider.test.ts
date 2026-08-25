import { describe, it, expect } from "vitest";
import { MockVoiceProvider } from "./voice-provider";

describe("MockVoiceProvider", () => {
  const provider = new MockVoiceProvider();

  it("is clearly marked as mock", () => {
    expect(provider.isMock).toBe(true);
  });

  it("produces a valid, playable WAV buffer with a positive duration", async () => {
    const result = await provider.synthesize({
      text: "Hello there, this is a test narration line.",
      style: "WARM",
      language: "en",
      speed: 1,
      pitch: 1,
    });

    expect(result.contentType).toBe("audio/wav");
    expect(result.buffer.toString("ascii", 0, 4)).toBe("RIFF");
    expect(result.buffer.toString("ascii", 8, 12)).toBe("WAVE");
    expect(result.durationSeconds).toBeGreaterThan(0);
  });

  it("produces longer audio for longer narration text", async () => {
    const short = await provider.synthesize({ text: "Hi.", style: "WARM", language: "en", speed: 1, pitch: 1 });
    const long = await provider.synthesize({
      text: "This is a much longer piece of narration with many more words in it than the short one.",
      style: "WARM",
      language: "en",
      speed: 1,
      pitch: 1,
    });
    expect(long.durationSeconds).toBeGreaterThan(short.durationSeconds);
  });

  it("produces shorter audio at higher speed for the same text", async () => {
    const normal = await provider.synthesize({
      text: "Some narration text of a fixed length here.",
      style: "WARM",
      language: "en",
      speed: 1,
      pitch: 1,
    });
    const fast = await provider.synthesize({
      text: "Some narration text of a fixed length here.",
      style: "WARM",
      language: "en",
      speed: 2,
      pitch: 1,
    });
    expect(fast.durationSeconds).toBeLessThan(normal.durationSeconds);
  });

  it("never produces zero-length audio, even for empty text", async () => {
    const result = await provider.synthesize({ text: "   ", style: "WARM", language: "en", speed: 1, pitch: 1 });
    expect(result.buffer.length).toBeGreaterThan(44);
    expect(result.durationSeconds).toBeGreaterThan(0);
  });

  it("clamps extreme speed/pitch values instead of producing invalid audio", async () => {
    const result = await provider.synthesize({
      text: "Testing extreme values.",
      style: "WARM",
      language: "en",
      speed: 999,
      pitch: -50,
    });
    expect(result.durationSeconds).toBeGreaterThan(0);
    expect(Number.isFinite(result.durationSeconds)).toBe(true);
  });
});
