import { ProviderNotConfiguredError } from "../errors.js";
import type {
  AiCapability,
  ImageProvider,
  LanguageModelProvider,
  MusicProvider,
  SoundEffectProvider,
  VideoProvider,
  VoiceProvider,
} from "../types.js";

/**
 * Returned by the registry for any capability with no configured provider.
 * Every method throws ProviderNotConfiguredError instead of returning a
 * fake result — this is the mechanism behind spec §81 ("do not simulate
 * generation").
 */
export function createUnconfiguredProvider(capability: AiCapability) {
  const throwNotConfigured = (): never => {
    throw new ProviderNotConfiguredError(capability);
  };

  const base = { providerName: "unconfigured" };

  const languageModel: LanguageModelProvider = {
    ...base,
    generateText: throwNotConfigured,
  };

  const image: ImageProvider = {
    ...base,
    generateImage: throwNotConfigured,
    analyzeImage: throwNotConfigured,
  };

  const video: VideoProvider = {
    ...base,
    generateVideo: throwNotConfigured,
    generateImageToVideo: throwNotConfigured,
    generateVideoToVideo: throwNotConfigured,
    analyzeVideo: throwNotConfigured,
  };

  const voice: VoiceProvider = {
    ...base,
    generateVoice: throwNotConfigured,
  };

  const music: MusicProvider = {
    ...base,
    generateMusic: throwNotConfigured,
  };

  const sfx: SoundEffectProvider = {
    ...base,
    generateSoundEffect: throwNotConfigured,
  };

  switch (capability) {
    case "TEXT":
      return languageModel;
    case "IMAGE":
    case "IMAGE_ANALYSIS":
      return image;
    case "VIDEO":
    case "IMAGE_TO_VIDEO":
    case "VIDEO_TO_VIDEO":
    case "VIDEO_ANALYSIS":
      return video;
    case "VOICE":
      return voice;
    case "MUSIC":
      return music;
    case "SOUND_EFFECT":
      return sfx;
    default: {
      const _exhaustive: never = capability;
      throw new Error(`Unhandled capability: ${_exhaustive}`);
    }
  }
}
