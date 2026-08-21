import { describe, expect, it } from "vitest";
import { ModelRouter } from "./router.js";
import { ProviderGenerationError, ProviderNotConfiguredError } from "./errors.js";
import type { ProviderRegistry } from "./registry.js";
import type { LanguageModelProvider } from "./types.js";

function fakeRegistry(candidates: LanguageModelProvider[]): ProviderRegistry {
  return {
    getCandidates: () => candidates,
    isConfigured: () => candidates.length > 0,
    get: () => candidates[0],
  } as unknown as ProviderRegistry;
}

describe("ModelRouter", () => {
  it("throws ProviderNotConfiguredError when no candidate is registered", async () => {
    const router = new ModelRouter(fakeRegistry([]));
    await expect(router.execute("TEXT", "BALANCED", async (p) => p.generateText({ prompt: "hi" }))).rejects.toBeInstanceOf(
      ProviderNotConfiguredError,
    );
  });

  it("fails over to the next candidate when the first raises a generation error", async () => {
    const failing: LanguageModelProvider = {
      providerName: "failing",
      generateText: async () => {
        throw new ProviderGenerationError("failing", "boom");
      },
    };
    const working: LanguageModelProvider = {
      providerName: "working",
      generateText: async () => ({ text: "ok", meta: { provider: "working", modelId: "m" } }),
    };

    const router = new ModelRouter(fakeRegistry([failing, working]));
    const result = await router.execute("TEXT", "BALANCED", (p) => p.generateText({ prompt: "hi" }));
    expect(result.text).toBe("ok");
  });

  it("does not fail over on a non-generation error", async () => {
    const throwsUnexpected: LanguageModelProvider = {
      providerName: "broken",
      generateText: async () => {
        throw new TypeError("unexpected");
      },
    };
    const router = new ModelRouter(fakeRegistry([throwsUnexpected]));
    await expect(router.execute("TEXT", "BALANCED", (p) => p.generateText({ prompt: "hi" }))).rejects.toBeInstanceOf(TypeError);
  });
});
