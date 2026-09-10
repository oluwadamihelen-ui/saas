import "server-only";
import type { AiProvider } from "@/lib/ai/types";
import { createOpenAiProvider } from "@/lib/ai/providers/openai";
import { createAnthropicProvider } from "@/lib/ai/providers/anthropic";

/// Unlike the payment provider registry, there is no honest "mock" fallback
/// here — faking an AI response would violate the one rule this feature
/// can't bend on (see ARCHITECTURE.md's AI section). No configured key
/// means no provider, and the assistant UI says so plainly instead of
/// pretending to answer.
export function getAiProvider(): AiProvider | null {
  const selected = process.env.AI_PROVIDER?.trim().toLowerCase();

  if (selected === "openai" || (!selected && process.env.OPENAI_API_KEY)) {
    const key = process.env.OPENAI_API_KEY;
    if (key) return createOpenAiProvider(key);
  }

  if (selected === "anthropic" || (!selected && process.env.ANTHROPIC_API_KEY)) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (key) return createAnthropicProvider(key);
  }

  return null;
}
