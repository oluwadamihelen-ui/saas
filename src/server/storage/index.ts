import type { StorageProvider } from "./types";
import { LocalStorageProvider } from "./local-provider";

export type { StorageProvider, StorageCategory } from "./types";

let cached: StorageProvider | null = null;

/**
 * Real S3-compatible providers (AWS S3, Cloudflare R2, MinIO) can be added
 * here once S3_* env vars are configured — the rest of the app only depends
 * on the StorageProvider interface, never on this factory's internals.
 */
export function getStorageProvider(): StorageProvider {
  if (cached) return cached;

  const providerName = process.env.STORAGE_PROVIDER ?? "local";

  switch (providerName) {
    case "local":
    default:
      cached = new LocalStorageProvider();
      return cached;
  }
}
