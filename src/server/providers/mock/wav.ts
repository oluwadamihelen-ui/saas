const SAMPLE_RATE = 22050;

/** Encodes 16-bit PCM mono samples (-1..1) into a valid WAV file buffer. */
export function encodeWav(samples: Float32Array, sampleRate: number = SAMPLE_RATE): Buffer {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28); // byte rate
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * bytesPerSample);
  }

  return buffer;
}

/** A short envelope-shaped tone — used as an honest, audible stand-in for speech/music. */
export function toneSamples(params: {
  durationSeconds: number;
  frequencyHz: number;
  sampleRate?: number;
  amplitude?: number;
}): Float32Array {
  const sampleRate = params.sampleRate ?? SAMPLE_RATE;
  const amplitude = params.amplitude ?? 0.3;
  const total = Math.max(1, Math.round(params.durationSeconds * sampleRate));
  const samples = new Float32Array(total);

  const attack = Math.min(total * 0.1, sampleRate * 0.02);
  const release = Math.min(total * 0.1, sampleRate * 0.05);

  for (let i = 0; i < total; i++) {
    const t = i / sampleRate;
    let envelope = 1;
    if (i < attack) envelope = i / attack;
    else if (i > total - release) envelope = (total - i) / release;
    samples[i] = Math.sin(2 * Math.PI * params.frequencyHz * t) * amplitude * envelope;
  }

  return samples;
}

/** Concatenates several tone segments (with small silent gaps) into one buffer — used to
 *  suggest speech cadence (a sequence of blips) rather than a single flat beep. */
export function sequenceSamples(segments: Float32Array[], gapSeconds: number, sampleRate = SAMPLE_RATE): Float32Array {
  const gap = Math.round(gapSeconds * sampleRate);
  const total = segments.reduce((sum, s) => sum + s.length + gap, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const seg of segments) {
    out.set(seg, offset);
    offset += seg.length + gap;
  }
  return out;
}
