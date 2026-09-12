import "server-only";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

async function fileToDataUrl(file: File, maxBytes: number, label: string): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error(`${label} must be a PNG, JPEG, WebP or SVG image.`);
  }
  if (file.size > maxBytes) {
    throw new Error(`${label} must be smaller than ${Math.round(maxBytes / (1024 * 1024))}MB.`);
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString("base64")}`;
}

/// Converts an uploaded logo <input type="file"> into a data: URL for
/// direct storage on School.logoUrl — this app has no object storage
/// (S3/Cloudinary), and a school crest is small enough that a data: URL
/// in Postgres is simpler and just as durable as a file on disk would be
/// in this single-instance deployment.
export async function fileToLogoDataUrl(file: File): Promise<string> {
  return fileToDataUrl(file, 2 * 1024 * 1024, "Logo");
}

/// Same data: URL approach as the school logo, for a student's passport
/// photograph on Student.photoUrl.
export async function fileToStudentPhotoDataUrl(file: File): Promise<string> {
  return fileToDataUrl(file, 2 * 1024 * 1024, "Photo");
}
