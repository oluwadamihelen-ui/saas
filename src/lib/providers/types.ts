// Shared types for the provider abstraction layer.
// Every third-party integration (payments, domains, DNS, hosting, deployment,
// email) is accessed through an interface defined in this directory, never
// directly. Concrete adapters (Mock*, Paystack, Namecheap, cPanel, ...)
// implement these interfaces and are looked up through the factory in
// `registry.ts`, keyed by the `adapterKey` stored on the `Provider` row.

export type ProviderConnectionState =
  | "CONNECTED"
  | "AUTH_FAILED"
  | "ENDPOINT_ERROR"
  | "RATE_LIMITED"
  | "UNAVAILABLE";

export interface ProviderTestResult {
  state: ProviderConnectionState;
  message: string;
  checkedAt: string;
}

export interface ProviderAdapterBase {
  /** Machine key stored in Provider.adapterKey, e.g. "mock", "paystack". */
  readonly key: string;
  /** Human label shown in the admin UI. */
  readonly label: string;
  /** Verifies credentials/connectivity without side effects. */
  testConnection(): Promise<ProviderTestResult>;
}

export class ProviderCapabilityError extends Error {
  constructor(providerKey: string, capability: string) {
    super(`Provider "${providerKey}" does not support capability "${capability}"`);
    this.name = "ProviderCapabilityError";
  }
}
