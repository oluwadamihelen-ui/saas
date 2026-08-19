import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { StorageProvider, StorageCategory } from "./types";

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

/**
 * Dev-only storage provider that writes to the Next.js public/ directory so
 * files are served statically. Swap for an S3-compatible provider in
 * production by implementing StorageProvider and switching the factory in
 * index.ts based on STORAGE_PROVIDER.
 */
export class LocalStorageProvider implements StorageProvider {
  async put(params: {
    category: StorageCategory;
    filename: string;
    data: Buffer;
    contentType: string;
  }): Promise<{ url: string; key: string }> {
    const ext = path.extname(params.filename) || extensionFromContentType(params.contentType);
    const key = `${params.category}/${crypto.randomUUID()}${ext}`;
    const fullPath = path.join(UPLOADS_ROOT, key);

    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, params.data);

    return { url: `/uploads/${key}`, key };
  }

  async delete(key: string): Promise<void> {
    const fullPath = path.join(UPLOADS_ROOT, key);
    await unlink(fullPath).catch(() => undefined);
  }
}

function extensionFromContentType(contentType: string): string {
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("svg")) return ".svg";
  if (contentType.includes("mpeg") || contentType.includes("mp3")) return ".mp3";
  if (contentType.includes("wav")) return ".wav";
  if (contentType.includes("mp4")) return ".mp4";
  return "";
}
