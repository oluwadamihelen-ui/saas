import type { Env } from "@cinerra/config";
import { AnthropicTextProvider } from "./providers/anthropic/textProvider.js";
import { OpenAiImageProvider } from "./providers/openai/imageProvider.js";
import { RunwayVideoProvider } from "./providers/runway/videoProvider.js";
import { ElevenLabsVoiceProvider } from "./providers/elevenlabs/voiceProvider.js";
import { ElevenLabsSoundEffectProvider } from "./providers/elevenlabs/soundEffectProvider.js";
import { ElevenLabsMusicProvider } from "./providers/elevenlabs/musicProvider.js";
import { createUnconfiguredProvider } from "./providers/unconfigured.js";
import type { AiCapability, CapabilityProviderMap } from "./types.js";

/**
 * Builds the set of configured provider instances from environment
 * credentials. Adding a new vendor for a capability (e.g. a second video
 * provider for failover, spec §26) means adding one adapter class and one
 * line here — no call sites elsewhere in the app change.
 */
export class ProviderRegistry {
  private readonly candidates = new Map<AiCapability, unknown[]>();

  constructor(env: Env) {
    const anthropic = env.ANTHROPIC_API_KEY ? new AnthropicTextProvider({ apiKey: env.ANTHROPIC_API_KEY }) : null;
    const openai = env.OPENAI_API_KEY ? new OpenAiImageProvider({ apiKey: env.OPENAI_API_KEY }) : null;
    const runway = env.RUNWAY_API_KEY ? new RunwayVideoProvider({ apiKey: env.RUNWAY_API_KEY }) : null;
    const elevenlabs = env.ELEVENLABS_API_KEY ? new ElevenLabsVoiceProvider({ apiKey: env.ELEVENLABS_API_KEY }) : null;
    const elevenlabsSfx = env.ELEVENLABS_API_KEY ? new ElevenLabsSoundEffectProvider({ apiKey: env.ELEVENLABS_API_KEY }) : null;
    const elevenlabsMusic = env.ELEVENLABS_API_KEY ? new ElevenLabsMusicProvider({ apiKey: env.ELEVENLABS_API_KEY }) : null;

    this.register("TEXT", [anthropic]);
    this.register("IMAGE", [openai]);
    this.register("IMAGE_ANALYSIS", [openai]);
    this.register("VIDEO", [runway]);
    this.register("IMAGE_TO_VIDEO", [runway]);
    this.register("VIDEO_TO_VIDEO", [runway]);
    this.register("VIDEO_ANALYSIS", [runway]);
    this.register("VOICE", [elevenlabs]);
    this.register("MUSIC", [elevenlabsMusic]);
    this.register("SOUND_EFFECT", [elevenlabsSfx]);
  }

  private register(capability: AiCapability, instances: Array<unknown | null | undefined>): void {
    this.candidates.set(
      capability,
      instances.filter((instance): instance is NonNullable<typeof instance> => instance != null),
    );
  }

  /** Ordered, priority-first list of configured providers (empty if none). */
  getCandidates<C extends AiCapability>(capability: C): Array<CapabilityProviderMap[C]> {
    return (this.candidates.get(capability) ?? []) as Array<CapabilityProviderMap[C]>;
  }

  isConfigured(capability: AiCapability): boolean {
    return this.getCandidates(capability).length > 0;
  }

  /** Convenience accessor for callers that don't need failover semantics. */
  get<C extends AiCapability>(capability: C): CapabilityProviderMap[C] {
    const candidates = this.getCandidates(capability);
    return candidates[0] ?? (createUnconfiguredProvider(capability) as CapabilityProviderMap[C]);
  }
}
