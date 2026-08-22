import type { GenerateSoundEffectInput, GenerateAudioResult, SoundEffectProvider } from "../../types.js";
import { ProviderGenerationError } from "../../errors.js";

export interface ElevenLabsSoundEffectProviderOptions {
  apiKey: string;
  modelId?: string;
}

/**
 * Real SoundEffectProvider implementation against the ElevenLabs Sound
 * Effects API (POST /v1/sound-generation). Like the voice adapter,
 * ElevenLabs returns audio bytes directly rather than a hosted URL, so
 * this wraps them in a data URL — the worker re-uploads to durable
 * storage exactly like every other provider (spec §40).
 */
export class ElevenLabsSoundEffectProvider implements SoundEffectProvider {
  readonly providerName = "elevenlabs";
  private readonly apiKey: string;
  private readonly modelId: string;

  constructor(options: ElevenLabsSoundEffectProviderOptions) {
    this.apiKey = options.apiKey;
    this.modelId = options.modelId ?? "eleven_text_to_sound_v2";
  }

  async generateSoundEffect(input: GenerateSoundEffectInput): Promise<GenerateAudioResult> {
    const startedAt = Date.now();
    // The API only accepts 0.5-30s; clamp rather than reject so a shot's
    // full duration always produces a usable cue.
    const durationSeconds = Math.min(30, Math.max(0.5, input.durationSeconds));

    const response = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
      method: "POST",
      headers: {
        "xi-api-key": this.apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: input.prompt,
        duration_seconds: durationSeconds,
        model_id: this.modelId,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new ProviderGenerationError(this.providerName, `ElevenLabs sound effect generation failed (${response.status}): ${body}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const providerUrl = `data:audio/mpeg;base64,${buffer.toString("base64")}`;

    return {
      providerUrl,
      meta: { provider: this.providerName, modelId: this.modelId, durationMs: Date.now() - startedAt },
    };
  }
}
