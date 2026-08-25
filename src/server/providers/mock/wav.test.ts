import { describe, it, expect } from "vitest";
import { encodeWav, toneSamples, sequenceSamples } from "./wav";

describe("encodeWav", () => {
  it("produces a valid RIFF/WAVE header with correct chunk sizes", () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const buf = encodeWav(samples, 22050);

    expect(buf.toString("ascii", 0, 4)).toBe("RIFF");
    expect(buf.toString("ascii", 8, 12)).toBe("WAVE");
    expect(buf.toString("ascii", 12, 16)).toBe("fmt ");
    expect(buf.toString("ascii", 36, 40)).toBe("data");

    const dataSize = buf.readUInt32LE(40);
    expect(dataSize).toBe(samples.length * 2);
    expect(buf.readUInt32LE(4)).toBe(36 + dataSize);
    expect(buf.length).toBe(44 + dataSize);

    // PCM, mono, sample rate, bits per sample
    expect(buf.readUInt16LE(20)).toBe(1);
    expect(buf.readUInt16LE(22)).toBe(1);
    expect(buf.readUInt32LE(24)).toBe(22050);
    expect(buf.readUInt16LE(34)).toBe(16);
  });

  it("clamps out-of-range samples instead of overflowing", () => {
    const buf = encodeWav(new Float32Array([2, -2]), 8000);
    expect(buf.readInt16LE(44)).toBe(32767);
    expect(buf.readInt16LE(46)).toBe(-32767);
  });

  it("round-trips a known sample value", () => {
    const buf = encodeWav(new Float32Array([0.5]), 8000);
    expect(buf.readInt16LE(44)).toBe(Math.round(0.5 * 32767));
  });
});

describe("toneSamples", () => {
  it("produces the expected number of samples for the given duration", () => {
    const samples = toneSamples({ durationSeconds: 1, frequencyHz: 440, sampleRate: 8000 });
    expect(samples.length).toBe(8000);
  });

  it("never exceeds the requested amplitude", () => {
    const samples = toneSamples({ durationSeconds: 0.5, frequencyHz: 220, sampleRate: 8000, amplitude: 0.3 });
    for (const s of samples) {
      // Float32Array storage rounds 0.3 to ~0.300000011920929 — allow for that.
      expect(Math.abs(s)).toBeLessThanOrEqual(0.3 + 1e-6);
    }
  });

  it("fades in from silence at the start (attack envelope)", () => {
    const samples = toneSamples({ durationSeconds: 1, frequencyHz: 440, sampleRate: 8000 });
    expect(samples[0]).toBeCloseTo(0, 5);
  });

  it("produces at least one sample even for a near-zero duration", () => {
    const samples = toneSamples({ durationSeconds: 0, frequencyHz: 440, sampleRate: 8000 });
    expect(samples.length).toBeGreaterThanOrEqual(1);
  });
});

describe("sequenceSamples", () => {
  it("concatenates segments with silent gaps between them", () => {
    const seg = new Float32Array([1, 1, 1]);
    const out = sequenceSamples([seg, seg], 0.5, 4);

    // gap = round(0.5 * 4) = 2 samples of silence between/after each segment
    expect(out.length).toBe((3 + 2) * 2);
    expect(Array.from(out.slice(0, 3))).toEqual([1, 1, 1]);
    expect(Array.from(out.slice(3, 5))).toEqual([0, 0]);
    expect(Array.from(out.slice(5, 8))).toEqual([1, 1, 1]);
  });

  it("returns an empty buffer for no segments", () => {
    expect(sequenceSamples([], 0.5).length).toBe(0);
  });
});
