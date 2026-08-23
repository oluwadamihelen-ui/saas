/**
 * Thrown whenever a capability is requested but no provider is configured
 * (no API key present) for it. Callers (API routes, workers) must catch
 * this and surface the honest, human-readable message required by spec
 * §81 — never simulate a result.
 */
export class ProviderNotConfiguredError extends Error {
  readonly capability: string;

  constructor(capability: string) {
    super(
      `No AI provider is configured for "${capability}". Add the relevant provider API key in Settings (or the environment) to enable this feature.`,
    );
    this.name = "ProviderNotConfiguredError";
    this.capability = capability;
  }
}

/** A provider call failed after exhausting retries/failover candidates. */
export class ProviderGenerationError extends Error {
  readonly provider: string;
  readonly cause2?: unknown;

  constructor(provider: string, message: string, cause?: unknown) {
    super(message);
    this.name = "ProviderGenerationError";
    this.provider = provider;
    this.cause2 = cause;
  }
}

/**
 * Thrown by a provider adapter that noticed its caller's cancellation
 * signal fired mid-request and actually stopped — including, where the
 * provider supports it, calling that provider's own cancel endpoint so it
 * stops billing/working server-side too, not just locally. Deliberately
 * does NOT extend ProviderGenerationError: the router must propagate this
 * immediately rather than failing over to another candidate, since the
 * caller asked to stop, not to retry with a different provider.
 */
export class ProviderCancelledError extends Error {
  readonly provider: string;

  constructor(provider: string) {
    super(`Generation was cancelled mid-request against ${provider}.`);
    this.name = "ProviderCancelledError";
    this.provider = provider;
  }
}
