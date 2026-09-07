import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { logger } from "@/lib/security/logger";

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

// Written straight to public/ so Next.js serves it as a static asset with
// no extra route needed -- the URL returned below is exactly where it
// lands. On the Docker/VPS setup this needs a persistent volume mounted
// at that path (documented in README.md) or uploads are lost on redeploy;
// fine for local dev and small installs without one.
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "applications");

/**
 * Admin-only image upload for application screenshots. Not a general file
 * upload endpoint -- scoped to APPLICATIONS_MANAGE and to a small set of
 * image types, written under a fixed, non-configurable directory.
 */
export async function POST(req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.APPLICATIONS_MANAGE);
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    if (error instanceof ForbiddenError) return NextResponse.json({ error: "You don't have permission to upload images." }, { status: 403 });
    throw error;
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const extension = ALLOWED_TYPES[file.type];
  if (!extension) {
    return NextResponse.json({ error: "Only PNG, JPEG, WEBP, and GIF images are allowed." }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Images must be 5MB or smaller." }, { status: 413 });
  }

  const filename = `${randomUUID()}.${extension}`;
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(UPLOAD_DIR, filename), bytes);
  } catch (error) {
    logger.error("admin.upload.write_failed", { error: error instanceof Error ? error.message : "unknown error" });
    return NextResponse.json({ error: "Could not save the image. Please try again." }, { status: 500 });
  }

  const url = `/uploads/applications/${filename}`;
  logger.info("admin.upload.image", { url, size: file.size, type: file.type });
  return NextResponse.json({ url });
}
