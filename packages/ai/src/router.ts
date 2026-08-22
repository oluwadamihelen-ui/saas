import { ProviderGenerationError, ProviderNotConfiguredError } from "./errors.js";
import type { AiCapability, CapabilityProviderMap, OptimizationMode } from "./types.js";
import type { ProviderRegistry } from "./registry.js";

/**
 * The internal Model Router (spec §4-5). Application code never calls a
 * provider adapter directly — it asks the router to execute an operation
 * against "the best available provider for this capability", and the
 * router handles failover across configured candidates.
 *
 * `mode` is accepted on every call so that once multiple providers are
 * configured for the same capability, admin-defined priority (via the
 * AiModel table) can reorder candidates per BEST_QUALITY / FASTEST /
 * BALANCED without any call-site change.
 */
export class ModelRouter {
  constructor(private readonly registry: ProviderRegistry) {}

  /** Lets a caller skip work (e.g. downloading a video for QC) when a capability has no configured provider at all. */
  isConfigured(capability: AiCapability): boolean {
    return this.registry.isConfigured(capability);
  }

  async execute<C extends AiCapability, R>(
    capability: C,
    _mode: OptimizationMode,
    operation: (provider: CapabilityProviderMap[C]) => Promise<R>,
  ): Promise<R> {
    const candidates = this.registry.getCandidates(capability);
    if (candidates.length === 0) {
      throw new ProviderNotConfiguredError(capability);
    }

    let lastError: unknown;
    for (const candidate of candidates) {
      try {
        return await operation(candidate);
      } catch (error) {
        lastError = error;
        // Only a generation failure triggers failover to the next
        // candidate; a not-configured or unexpected error propagates
        // immediately rather than being silently swallowed.
        if (error instanceof ProviderGenerationError) {
          continue;
        }
        throw error;
      }
    }
    throw lastError instanceof Error ? lastError : new ProviderGenerationError("unknown", "All configured providers failed.");
  }
}
