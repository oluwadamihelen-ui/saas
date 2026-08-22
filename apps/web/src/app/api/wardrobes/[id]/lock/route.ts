import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";

/** Locking a wardrobe (spec §13, §58): once locked, its identity is a hard continuity constraint the Character Designer must never silently rewrite. */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const wardrobe = await prisma.wardrobe.findUnique({ where: { id: params.id }, include: { project: true } });
    if (!wardrobe) throw new Error("NOT_FOUND");
    if (wardrobe.project.ownerId !== userId) throw new Error("FORBIDDEN");

    const updated = await prisma.wardrobe.update({ where: { id: wardrobe.id }, data: { isLocked: true } });
    return NextResponse.json({ wardrobe: updated });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
