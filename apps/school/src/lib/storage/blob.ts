import "server-only";
import { put, del, get } from "@vercel/blob";

/// Object storage for lecture videos/documents and live class recordings —
/// the data: URL pattern used for logos/photos (src/lib/logo-upload.ts) is
/// explicitly unsuitable here (a 2-hour lecture video would never fit as a
/// base64 column, let alone one loaded on every query). Vercel Blob is the
/// natural fit for this app's Vercel hosting, the same "bring your own
/// credentials, degrade honestly if unset" shape as every other external
/// integration in this codebase (payment gateways, AI providers, and now
/// LiveKit) — BLOB_READ_WRITE_TOKEN unset means uploads are refused with a
/// clear message instead of silently failing.
///
/// Every file is stored with access: "private" — the returned blob url is
/// never sent to a browser. The only way to read a file back is the
/// authenticated route in src/app/api/online-learning/files/[fileId]/route.ts,
/// which re-runs the same visibility check as the lecture/recording it
/// belongs to before streaming the bytes through — never a bare public URL
/// a student could bookmark or forward once logged out.
export function isBlobStorageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export interface UploadedFile {
  url: string;
  size: number;
  contentType: string;
}

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

export async function uploadOnlineLearningFile(
  schoolId: string,
  category: "lectures" | "recordings",
  file: File
): Promise<UploadedFile> {
  if (!isBlobStorageConfigured()) {
    throw new Error("File storage is not configured for this deployment. Ask your administrator to set up storage.");
  }
  const pathname = `online-learning/${category}/${schoolId}/${crypto.randomUUID()}-${safeFilename(file.name)}`;
  const blob = await put(pathname, file, {
    access: "private",
    contentType: file.type || undefined,
  });
  return { url: blob.url, size: file.size, contentType: file.type || "application/octet-stream" };
}

export async function deleteOnlineLearningFile(url: string): Promise<void> {
  if (!isBlobStorageConfigured()) return;
  try {
    await del(url);
  } catch {
    // Already deleted, or the store no longer has it — nothing more to do.
  }
}

export interface StreamedFile {
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  size: number;
}

/// Called only from src/app/api/online-learning/files/[fileId]/route.ts,
/// after that route has already verified the requesting user is allowed to
/// see the lecture resource / recording this url belongs to.
export async function streamOnlineLearningFile(url: string): Promise<StreamedFile | null> {
  if (!isBlobStorageConfigured()) return null;
  try {
    const result = await get(url, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    return { stream: result.stream, contentType: result.blob.contentType, size: result.blob.size };
  } catch {
    return null;
  }
}
