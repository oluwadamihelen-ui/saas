import type { GenerateMusicInput, GenerateAudioResult, MusicProvider } from "../../types.js";
import { ProviderGenerationError } from "../../errors.js";

export interface ElevenLabsMusicProviderOptions {
  apiKey: string;
  modelId?: string;
}

/**
 * Real MusicProvider implementation against the ElevenLabs Music API
 * (POST /v1/music). Same "download bytes, wrap as data URL, let the
 * worker persist to durable storage" pattern as the voice/SFX adapters.
 */
export class ElevenLabsMusicProvider implements MusicProvider {
  readonly providerName = "elevenlabs";
  private readonly apiKey: string;
  private readonly modelId: string;

  constructor(options: ElevenLabsMusicProviderOptions) {
    this.apiKey = options.apiKey;
    this.modelId = options.modelId ?? "music_v2";
  }

  async generateMusic(input: GenerateMusicInput): Promise<GenerateAudioResult> {
    const startedAt = Date.now();
    // The API only accepts 3s-600s (10 minutes); clamp so an episode's
    // runtime always produces a usable score length.
    const musicLengthMs = Math.min(600_000, Math.max(3_000, Math.round(input.durationSeconds * 1000)));
    const prompt = input.mood ? `${input.prompt} Mood: ${input.mood}.` : input.prompt;

    const response = await fetch("https://api.elevenlabs.io/v1/music", {
      method: "POST",
      headers: {
        "xi-api-key": this.apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        prompt,
        music_length_ms: musicLengthMs,
        model_id: this.modelId,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new ProviderGenerationError(this.providerName, `ElevenLabs music generation failed (${response.status}): ${body}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const providerUrl = `data:audio/mpeg;base64,${buffer.toString("base64")}`;

    return {
      providerUrl,
      meta: { provider: this.providerName, modelId: this.modelId, durationMs: Date.now() - startedAt },
    };
  }
}
