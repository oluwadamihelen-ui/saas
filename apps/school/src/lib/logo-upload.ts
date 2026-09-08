import "server-only";

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

/// Converts an uploaded logo <input type="file"> into a data: URL for
/// direct storage on School.logoUrl — this app has no object storage
/// (S3/Cloudinary), and a school crest is small enough that a data: URL
/// in Postgres is simpler and just as durable as a file on disk would be
/// in this single-instance deployment.
export async function fileToLogoDataUrl(file: File): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Logo must be a PNG, JPEG, WebP or SVG image.");
  }
  if (file.size > MAX_LOGO_BYTES) {
    throw new Error("Logo must be smaller than 2MB.");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString("base64")}`;
}
