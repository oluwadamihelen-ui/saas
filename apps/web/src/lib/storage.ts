import { createStorageClient, type StorageClient } from "@cinerra/storage";
import { env } from "./env";

const globalForStorage = globalThis as unknown as { storage?: StorageClient };

export const storageClient = globalForStorage.storage ?? createStorageClient(env);

if (process.env.NODE_ENV !== "production") {
  globalForStorage.storage = storageClient;
}

/** Signed, time-limited display URL for an asset's storage key (spec §40 — never a raw provider URL). */
export async function getAssetDisplayUrl(storageKey: string): Promise<string> {
  return storageClient.getSignedDownloadUrl(storageKey, 3600);
}
