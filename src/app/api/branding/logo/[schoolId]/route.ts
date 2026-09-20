import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadEmbeddableImage } from "@/lib/services/pdf-images";

/// Serves a school's logo as a real https:// image, decoded from the
/// data: URL stored on School.logoUrl (this app has no external object
/// storage — see that field's doc comment). Exists specifically so HTML
/// emails can reference a normal <img src> instead of a data: URI, which
/// most email clients (Gmail included) strip or refuse to render in a
/// message body. loadEmbeddableImage also normalizes WebP/SVG to PNG,
/// since those don't render reliably in email clients either.
///
/// Public and unauthenticated on purpose: logos are already shown on the
/// public apply/pay pages for this same school, and an email client
/// fetching this image has no session to send.
export async function GET(_req: Request, { params }: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = await params;
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { logoUrl: true } });
  if (!school?.logoUrl) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const image = await loadEmbeddableImage(school.logoUrl);
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(image as unknown as BodyInit, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
