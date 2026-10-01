import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage";

/** Screenshots are never public: ownership is checked on every request. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const shot = await prisma.tradeScreenshot.findFirst({ where: { id, userId: session.user.id } });
  if (!shot) return new NextResponse("Not found", { status: 404 });
  const data = await getStorage().get(shot.storageKey).catch(() => null);
  if (!data) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(data), {
    headers: { "Content-Type": shot.mimeType, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=3600", "Content-Disposition": "inline" },
  });
}
