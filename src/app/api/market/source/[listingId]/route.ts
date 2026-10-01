import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSourceForUser } from "@/lib/market/access";

export const dynamic = "force-dynamic";

/** Pine source download. All rules live in getSourceForUser(): owner, or active licensee of a source-included product. */
export async function GET(_req: Request, { params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  const session = await auth();
  const r = await getSourceForUser(session?.user?.id ?? null, listingId);
  if (!r.ok) return new NextResponse(r.status === 401 ? "Unauthorized" : "Not found", { status: r.status === 401 ? 401 : 404 }); // don't reveal whether a product exists
  return new NextResponse(r.code, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="${r.filename}"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
