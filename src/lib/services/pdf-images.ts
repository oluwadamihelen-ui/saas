import "server-only";
import sharp from "sharp";

/// School logos, student photos and report card design assets are all
/// stored as data: URLs (this app has no external object storage) — decode
/// straight to a Buffer. Returns null for anything else (unset, or a
/// future non-data URL scheme) so the caller can just skip drawing it.
export function dataUrlToBuffer(dataUrl: string | null | undefined): Buffer | null {
  if (!dataUrl || !dataUrl.startsWith("data:")) return null;
  const comma = dataUrl.indexOf(",");
  if (comma === -1) return null;
  try {
    return Buffer.from(dataUrl.slice(comma + 1), "base64");
  } catch {
    return null;
  }
}

/// pdfkit's doc.image() only understands raw JPEG and PNG bytes — but the
/// upload forms also accept WebP (all of them) and SVG (logo/header/
/// watermark/signature), per their own accept attributes. Uploading one of
/// those formats used to store fine and preview fine in the browser, but
/// silently produced an empty image box in a generated PDF, since a bare
/// doc.image() try/catch swallows pdfkit's "Unknown image format" error.
/// Normalizing every image through sharp here (which does understand
/// WebP/SVG/GIF/TIFF, unlike pdfkit) fixes both newly uploaded images and
/// ones already sitting in the database from before this fix, with no
/// need to re-upload anything.
export async function toEmbeddableImageBuffer(buffer: Buffer): Promise<Buffer | null> {
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  if (isJpeg || isPng) return buffer;
  try {
    return await sharp(buffer).png().toBuffer();
  } catch {
    return null;
  }
}

/// Combines the two steps above — the common case for turning a School/
/// Student data: URL field into something doc.image() can draw.
export async function loadEmbeddableImage(dataUrl: string | null | undefined): Promise<Buffer | null> {
  const raw = dataUrlToBuffer(dataUrl);
  return raw ? toEmbeddableImageBuffer(raw) : null;
}
