import type { GenerateVoiceInput, GenerateVoiceResult, VoiceProvider } from "../../types.js";
import { ProviderGenerationError } from "../../errors.js";

export interface ElevenLabsVoiceProviderOptions {
  apiKey: string;
  modelId?: string;
}

/**
 * Real VoiceProvider implementation against the ElevenLabs text-to-speech
 * API. ElevenLabs returns audio bytes directly rather than a hosted URL,
 * so this adapter uploads the bytes to a short-lived data URL placeholder
 * for the caller — the worker still re-uploads to durable storage exactly
 * like every other provider (spec §40).
 */
export class ElevenLabsVoiceProvider implements VoiceProvider {
  readonly providerName = "elevenlabs";
  private readonly apiKey: string;
  private readonly modelId: string;

  constructor(options: ElevenLabsVoiceProviderOptions) {
    this.apiKey = options.apiKey;
    this.modelId = options.modelId ?? "eleven_multilingual_v2";
  }

  async generateVoice(input: GenerateVoiceInput): Promise<GenerateVoiceResult> {
    const startedAt = Date.now();
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${input.voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": this.apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: input.text,
        model_id: this.modelId,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new ProviderGenerationError(this.providerName, `ElevenLabs voice generation failed (${response.status}): ${body}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const providerUrl = `data:audio/mpeg;base64,${buffer.toString("base64")}`;

    return {
      providerUrl,
      meta: { provider: this.providerName, modelId: this.modelId, durationMs: Date.now() - startedAt },
    };
  }
}
