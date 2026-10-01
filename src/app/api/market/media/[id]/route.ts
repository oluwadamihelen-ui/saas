import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { isPubliclyViewable } from "@/lib/market/listings";

/** Listing screenshots: public only while the listing is public; otherwise creator/admin only. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await prisma.listingMedia.findUnique({ where: { id }, select: { storageKey: true, mimeType: true, listing: { select: { status: true, indicator: { select: { visibility: true } }, creator: { select: { userId: true, status: true } } } } } });
  if (!m) return new NextResponse("Not found", { status: 404 });
  if (!isPubliclyViewable(m.listing)) {
    const session = await auth();
    const uid = session?.user?.id;
    const admin = uid ? (await prisma.user.findUnique({ where: { id: uid }, select: { role: true } }))?.role === "ADMIN" : false;
    if (!uid || (uid !== m.listing.creator.userId && !admin)) return new NextResponse("Not found", { status: 404 });
  }
  const data = await getStorage().get(m.storageKey).catch(() => null);
  if (!data) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(data), { headers: { "Content-Type": m.mimeType, "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=300", "Content-Disposition": "inline" } });
}
