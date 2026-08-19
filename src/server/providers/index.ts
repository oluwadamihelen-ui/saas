import type { AIProvider, ImageProvider } from "./types";
import { MockAIProvider } from "./mock/ai-provider";
import { MockImageProvider } from "./mock/image-provider";

export type { AIProvider, ImageProvider, ScriptAnalysis, StoryboardResult, StoryboardScene, StoryboardCharacter, GeneratedAsset } from "./types";

let aiProvider: AIProvider | null = null;
let imageProvider: ImageProvider | null = null;

/**
 * Real adapters (OpenAI, Anthropic, etc.) get added here once API keys are
 * configured — everything downstream only depends on the AIProvider
 * interface. AI_PROVIDER=mock (the .env.example default) always resolves
 * to MockAIProvider so the full pipeline works with zero external keys.
 */
export function getAIProvider(): AIProvider {
  if (aiProvider) return aiProvider;

  const name = process.env.AI_PROVIDER ?? "mock";
  switch (name) {
    case "mock":
    default:
      aiProvider = new MockAIProvider();
      return aiProvider;
  }
}

export function getImageProvider(): ImageProvider {
  if (imageProvider) return imageProvider;

  const name = process.env.IMAGE_PROVIDER ?? "mock";
  switch (name) {
    case "mock":
    default:
      imageProvider = new MockImageProvider();
      return imageProvider;
  }
}
