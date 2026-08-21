import type { GenerateImageInput, GenerateImageResult, ImageProvider } from "../../types.js";
import { ProviderGenerationError } from "../../errors.js";

export interface OpenAiImageProviderOptions {
  apiKey: string;
  modelId?: string;
}

/** Real ImageProvider implementation against the OpenAI Images API. */
export class OpenAiImageProvider implements ImageProvider {
  readonly providerName = "openai";
  private readonly apiKey: string;
  private readonly modelId: string;

  constructor(options: OpenAiImageProviderOptions) {
    this.apiKey = options.apiKey;
    this.modelId = options.modelId ?? "gpt-image-1";
  }

  async generateImage(input: GenerateImageInput): Promise<GenerateImageResult> {
    const startedAt = Date.now();
    const size = input.aspectRatio === "9:16" ? "1024x1536" : input.aspectRatio === "16:9" ? "1536x1024" : "1024x1024";

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.modelId,
        prompt: composePrompt(input),
        size,
        n: 1,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new ProviderGenerationError(this.providerName, `OpenAI image generation failed (${response.status}): ${body}`);
    }

    const json = (await response.json()) as { data: Array<{ url?: string; b64_json?: string }> };
    const first = json.data[0];
    if (!first?.url) {
      throw new ProviderGenerationError(this.providerName, "OpenAI image generation returned no image URL.");
    }

    return {
      providerUrl: first.url,
      meta: { provider: this.providerName, modelId: this.modelId, durationMs: Date.now() - startedAt },
    };
  }

  async analyzeImage(input: { imageUrl: string; question: string }): Promise<{ answer: string; meta: { provider: string; modelId: string } }> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: input.question },
              { type: "image_url", image_url: { url: input.imageUrl } },
            ],
          },
        ],
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new ProviderGenerationError(this.providerName, `OpenAI image analysis failed (${response.status}): ${body}`);
    }
    const json = (await response.json()) as { choices: Array<{ message: { content: string } }> };
    return {
      answer: json.choices[0]?.message.content ?? "",
      meta: { provider: this.providerName, modelId: "gpt-4o-mini" },
    };
  }
}

function composePrompt(input: GenerateImageInput): string {
  const parts = [input.prompt];
  if (input.negativePrompt) parts.push(`Avoid: ${input.negativePrompt}`);
  return parts.join("\n");
}
