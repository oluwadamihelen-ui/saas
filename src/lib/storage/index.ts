import { promises as fs } from "fs";
import path from "path";

/**
 * File storage abstraction. Screenshots are only ever addressed by an opaque
 * key and served through an authorised route — never from a public folder.
 * Add S3 / Cloudflare R2 / Supabase adapters by implementing StorageProvider.
 */
export interface StorageProvider {
  put(key: string, data: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

class LocalStorage implements StorageProvider {
  private root = path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_LOCAL_DIR ?? ".uploads");
  private resolve(key: string) {
    const p = path.resolve(this.root, key);
    if (!p.startsWith(this.root + path.sep)) throw new Error("Invalid storage key"); // path traversal guard
    return p;
  }
  async put(key: string, data: Buffer) {
    const p = this.resolve(key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, data);
  }
  get(key: string) {
    return fs.readFile(this.resolve(key));
  }
  async delete(key: string) {
    await fs.rm(this.resolve(key), { force: true });
  }
}

export function getStorage(): StorageProvider {
  const name = (process.env.STORAGE_PROVIDER ?? "local").toLowerCase();
  if (name === "local") return new LocalStorage();
  throw new Error(`STORAGE_PROVIDER "${name}" is not implemented yet — add an adapter in src/lib/storage.`);
}

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Detects the real image type from magic bytes (never trust the client's MIME/extension). */
export function sniffImage(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return { mime: "image/webp", ext: "webp" };
  return null;
}
