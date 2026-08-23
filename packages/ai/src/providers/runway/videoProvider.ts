import type {
  GenerateImageToVideoInput,
  GenerateVideoInput,
  GenerateVideoResult,
  GenerateVideoToVideoInput,
  VideoProvider,
} from "../../types.js";
import { ProviderCancelledError, ProviderGenerationError } from "../../errors.js";

export interface RunwayVideoProviderOptions {
  apiKey: string;
  modelId?: string;
  /** Polling interval while waiting for the async provider task to finish. */
  pollIntervalMs?: number;
  maxPollMs?: number;
}

const RUNWAY_API_BASE = "https://api.dev.runwayml.com/v1";

/**
 * Real VideoProvider implementation against Runway's async task API
 * (spec §3, §24): submit a task, poll until it succeeds or fails, return
 * the provider-hosted output URL for the caller to download into durable
 * storage. Runway is reference-image driven, which is exactly the
 * continuity mechanism the product's Visual Continuity Engine relies on.
 */
export class RunwayVideoProvider implements VideoProvider {
  readonly providerName = "runway";
  private readonly apiKey: string;
  private readonly modelId: string;
  private readonly pollIntervalMs: number;
  private readonly maxPollMs: number;

  constructor(options: RunwayVideoProviderOptions) {
    this.apiKey = options.apiKey;
    this.modelId = options.modelId ?? "gen4_turbo";
    this.pollIntervalMs = options.pollIntervalMs ?? 4000;
    this.maxPollMs = options.maxPollMs ?? 5 * 60 * 1000;
  }

  async generateVideo(input: GenerateVideoInput): Promise<GenerateVideoResult> {
    // Runway's text-only endpoint requires at least one seed/reference image
    // in practice; without one we fail honestly rather than silently
    // degrading quality.
    const firstReference = input.referenceImages?.[0]?.url;
    if (!firstReference) {
      throw new ProviderGenerationError(
        this.providerName,
        "Runway requires at least one reference image for generation. Generate or upload a reference image first.",
      );
    }
    return this.generateImageToVideo({ ...input, sourceImageUrl: firstReference });
  }

  async generateImageToVideo(input: GenerateImageToVideoInput): Promise<GenerateVideoResult> {
    const task = await this.submitTask("/image_to_video", {
      promptImage: input.sourceImageUrl,
      promptText: composePrompt(input),
      model: this.modelId,
      ratio: mapAspectRatio(input.aspectRatio),
      duration: input.durationSeconds,
    });
    return this.pollUntilDone(task.id, input.signal);
  }

  async generateVideoToVideo(input: GenerateVideoToVideoInput): Promise<GenerateVideoResult> {
    const task = await this.submitTask("/video_to_video", {
      videoUri: input.sourceVideoUrl,
      promptText: composePrompt(input),
      model: this.modelId,
      ratio: mapAspectRatio(input.aspectRatio),
    });
    return this.pollUntilDone(task.id, input.signal);
  }

  async analyzeVideo(): Promise<{ answer: string; meta: { provider: string; modelId: string } }> {
    throw new ProviderGenerationError(this.providerName, "Runway does not support video analysis; configure a provider that does.");
  }

  private async submitTask(path: string, body: Record<string, unknown>): Promise<{ id: string }> {
    const response = await fetch(`${RUNWAY_API_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new ProviderGenerationError(this.providerName, `Runway task submission failed (${response.status}): ${text}`);
    }
    return (await response.json()) as { id: string };
  }

  private async pollUntilDone(taskId: string, signal?: AbortSignal): Promise<GenerateVideoResult> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < this.maxPollMs) {
      if (signal?.aborted) {
        await this.cancelTask(taskId);
        throw new ProviderCancelledError(this.providerName);
      }

      const response = await fetch(`${RUNWAY_API_BASE}/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${this.apiKey}`, "X-Runway-Version": "2024-11-06" },
      });
      if (!response.ok) {
        throw new ProviderGenerationError(this.providerName, `Runway task polling failed (${response.status}).`);
      }
      const task = (await response.json()) as { status: string; output?: string[]; failure?: string };

      if (task.status === "SUCCEEDED" && task.output?.[0]) {
        return {
          providerUrl: task.output[0],
          meta: { provider: this.providerName, modelId: this.modelId, externalTaskId: taskId, durationMs: Date.now() - startedAt },
        };
      }
      if (task.status === "FAILED" || task.status === "CANCELLED") {
        throw new ProviderGenerationError(this.providerName, `Runway generation ${task.status.toLowerCase()}: ${task.failure ?? "unknown reason"}`);
      }
      await sleep(this.pollIntervalMs);
    }
    throw new ProviderGenerationError(this.providerName, "Runway generation timed out waiting for a result.");
  }

  /**
   * Runway's own docs are explicit that a local abort/timeout does NOT
   * stop the task server-side — only calling this endpoint does. Without
   * it, "cancelling" here would just mean we stop looking at a task
   * Runway keeps generating (and billing) regardless.
   */
  private async cancelTask(taskId: string): Promise<void> {
    try {
      const response = await fetch(`${RUNWAY_API_BASE}/tasks/${taskId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${this.apiKey}`, "X-Runway-Version": "2024-11-06" },
      });
      if (!response.ok) {
        console.error(`[runway] failed to cancel task ${taskId} (${response.status}) — it may keep running/billing on Runway's side.`);
      }
    } catch (error) {
      console.error(`[runway] failed to cancel task ${taskId}:`, error instanceof Error ? error.message : error);
    }
  }
}

function composePrompt(input: GenerateVideoInput): string {
  const parts = [input.prompt];
  if (input.negativePrompt) parts.push(`Negative: ${input.negativePrompt}`);
  return parts.join("\n");
}

function mapAspectRatio(ratio: "16:9" | "9:16" | "1:1"): string {
  switch (ratio) {
    case "16:9":
      return "1280:720";
    case "9:16":
      return "720:1280";
    case "1:1":
      return "960:960";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
