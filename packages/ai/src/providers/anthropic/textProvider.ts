import Anthropic from "@anthropic-ai/sdk";
import type { GenerateTextInput, GenerateTextResult, LanguageModelProvider } from "../../types.js";
import { ProviderGenerationError } from "../../errors.js";

export interface AnthropicTextProviderOptions {
  apiKey: string;
  modelId?: string;
}

/**
 * Real LanguageModelProvider implementation against the Anthropic API.
 * This is the first production capability wired end-to-end (Story
 * Architect, Screenwriter, Character/Location Designer agents all call
 * through this interface — never the Anthropic SDK directly).
 */
export class AnthropicTextProvider implements LanguageModelProvider {
  readonly providerName = "anthropic";
  private readonly client: Anthropic;
  private readonly modelId: string;

  constructor(options: AnthropicTextProviderOptions) {
    this.client = new Anthropic({ apiKey: options.apiKey });
    this.modelId = options.modelId ?? "claude-sonnet-5";
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const startedAt = Date.now();
    try {
      const response = await this.client.messages.create({
        model: this.modelId,
        max_tokens: input.maxTokens ?? 4096,
        temperature: input.temperature ?? 0.8,
        system: input.system,
        messages: [{ role: "user", content: input.prompt }],
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");

      return {
        text,
        meta: {
          provider: this.providerName,
          modelId: this.modelId,
          externalTaskId: response.id,
          durationMs: Date.now() - startedAt,
        },
      };
    } catch (error) {
      throw new ProviderGenerationError(this.providerName, "The language model provider failed to generate a response.", error);
    }
  }
}
