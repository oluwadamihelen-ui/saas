/**
 * Provider-agnostic capability interfaces (spec §3). Every AI feature in
 * the product is expressed as a call against one of these interfaces —
 * application code never imports a vendor SDK directly.
 */

export type OptimizationMode = "BEST_QUALITY" | "FASTEST" | "BALANCED";

export interface ReferenceImage {
  /** Durable storage URL (signed or CDN) — never an ephemeral provider URL. */
  url: string;
  label?: string;
}

export interface ProviderCallMeta {
  provider: string;
  modelId: string;
  /** Provider-native task id, for async polling/webhook correlation. */
  externalTaskId?: string;
  durationMs?: number;
  costCents?: number;
}

// --- Language model ---------------------------------------------------

export interface GenerateTextInput {
  system?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  /** Forces the model to return JSON matching this shape description. */
  jsonSchemaHint?: string;
}

export interface GenerateTextResult {
  text: string;
  meta: ProviderCallMeta;
}

export interface LanguageModelProvider {
  readonly providerName: string;
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
}

// --- Image ---------------------------------------------------------------

export interface GenerateImageInput {
  prompt: string;
  negativePrompt?: string;
  referenceImages?: ReferenceImage[];
  aspectRatio?: "16:9" | "9:16" | "1:1";
}

export interface GenerateImageResult {
  /** Ephemeral provider-hosted URL — caller MUST download and persist to durable storage. */
  providerUrl: string;
  meta: ProviderCallMeta;
}

export interface ImageProvider {
  readonly providerName: string;
  generateImage(input: GenerateImageInput): Promise<GenerateImageResult>;
  analyzeImage(input: { imageUrl: string; question: string }): Promise<{ answer: string; meta: ProviderCallMeta }>;
}

// --- Video -----------------------------------------------------------------

export interface GenerateVideoInput {
  prompt: string;
  negativePrompt?: string;
  referenceImages?: ReferenceImage[];
  durationSeconds: number;
  aspectRatio: "16:9" | "9:16" | "1:1";
  /**
   * Video generation is the one capability that genuinely runs for
   * minutes (an async provider task, usually polled). A caller that wants
   * to support mid-flight cancellation passes a signal here; a provider
   * that honors it must call its own cancel endpoint (not just stop
   * polling locally) before throwing ProviderCancelledError, since an
   * abort signal alone doesn't stop most providers' billed server-side
   * work. Providers that don't support real cancellation may ignore this.
   */
  signal?: AbortSignal;
}

export interface GenerateImageToVideoInput extends GenerateVideoInput {
  sourceImageUrl: string;
}

export interface GenerateVideoToVideoInput extends GenerateVideoInput {
  sourceVideoUrl: string;
}

export interface GenerateVideoResult {
  /** Ephemeral provider-hosted URL — caller MUST download and persist to durable storage. */
  providerUrl: string;
  meta: ProviderCallMeta;
}

export interface VideoProvider {
  readonly providerName: string;
  generateVideo(input: GenerateVideoInput): Promise<GenerateVideoResult>;
  generateImageToVideo(input: GenerateImageToVideoInput): Promise<GenerateVideoResult>;
  generateVideoToVideo(input: GenerateVideoToVideoInput): Promise<GenerateVideoResult>;
  analyzeVideo(input: { videoUrl: string; question: string }): Promise<{ answer: string; meta: ProviderCallMeta }>;
}

// --- Voice -----------------------------------------------------------------

export interface GenerateVoiceInput {
  text: string;
  voiceId: string;
  language?: string;
  emotion?: string;
}

export interface GenerateVoiceResult {
  providerUrl: string;
  meta: ProviderCallMeta;
}

export interface VoiceProvider {
  readonly providerName: string;
  generateVoice(input: GenerateVoiceInput): Promise<GenerateVoiceResult>;
}

// --- Music / SFX -------------------------------------------------------------

export interface GenerateMusicInput {
  prompt: string;
  durationSeconds: number;
  mood?: string;
}

export interface GenerateSoundEffectInput {
  prompt: string;
  durationSeconds: number;
}

export interface GenerateAudioResult {
  providerUrl: string;
  meta: ProviderCallMeta;
}

export interface MusicProvider {
  readonly providerName: string;
  generateMusic(input: GenerateMusicInput): Promise<GenerateAudioResult>;
}

export interface SoundEffectProvider {
  readonly providerName: string;
  generateSoundEffect(input: GenerateSoundEffectInput): Promise<GenerateAudioResult>;
}

export type AiCapability =
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "IMAGE_TO_VIDEO"
  | "VIDEO_TO_VIDEO"
  | "VOICE"
  | "SOUND_EFFECT"
  | "MUSIC"
  | "IMAGE_ANALYSIS"
  | "VIDEO_ANALYSIS";

/** Union of every provider interface, keyed by the capability it serves. */
export interface CapabilityProviderMap {
  TEXT: LanguageModelProvider;
  IMAGE: ImageProvider;
  VIDEO: VideoProvider;
  IMAGE_TO_VIDEO: VideoProvider;
  VIDEO_TO_VIDEO: VideoProvider;
  VOICE: VoiceProvider;
  SOUND_EFFECT: SoundEffectProvider;
  MUSIC: MusicProvider;
  IMAGE_ANALYSIS: ImageProvider;
  VIDEO_ANALYSIS: VideoProvider;
}
