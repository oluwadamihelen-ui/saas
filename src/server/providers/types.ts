import type { AspectRatio, VisualStyle } from "@/generated/prisma/enums";

export interface ScriptAnalysis {
  summary: string;
  tone: string;
  pacing: string;
  suggestedSceneCount: number;
}

export interface StoryboardCharacter {
  name: string;
  appearance: string;
  personality: string;
}

export interface StoryboardScene {
  title: string;
  narration: string;
  visualPrompt: string;
  location: string;
  camera: string;
  transition: string;
  durationSeconds: number;
  characterNames: string[];
}

export interface StoryboardResult {
  scenes: StoryboardScene[];
  characters: StoryboardCharacter[];
}

export interface GeneratedAsset {
  buffer: Buffer;
  contentType: string;
}

/** Text/reasoning provider: script analysis and storyboard generation. */
export interface AIProvider {
  readonly name: string;
  readonly isMock: boolean;

  analyzeScript(input: {
    idea?: string;
    script?: string;
    language: string;
  }): Promise<ScriptAnalysis>;

  generateStoryboard(input: {
    idea?: string;
    script?: string;
    style: VisualStyle;
    language: string;
    targetLengthSeconds?: number;
  }): Promise<StoryboardResult>;
}

export interface VoiceProvider {
  readonly name: string;
  readonly isMock: boolean;

  synthesize(input: {
    text: string;
    style: string;
    language: string;
    accent?: string;
    speed: number;
    pitch: number;
  }): Promise<GeneratedAsset & { durationSeconds: number }>;
}

export interface MusicProvider {
  readonly name: string;
  readonly isMock: boolean;

  generateTrack(input: {
    mood: string;
    durationSeconds: number;
  }): Promise<GeneratedAsset & { durationSeconds: number }>;
}

export interface ImageProvider {
  readonly name: string;
  readonly isMock: boolean;

  generateSceneImage(input: {
    prompt: string;
    style: VisualStyle;
    aspectRatio: AspectRatio;
    sceneNumber: number;
    sceneTitle: string;
    characterDescriptors: string[];
  }): Promise<GeneratedAsset>;

  generateCharacterPortrait(input: {
    name: string;
    descriptor: string;
  }): Promise<GeneratedAsset>;
}
