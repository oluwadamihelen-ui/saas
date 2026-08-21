import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";

/**
 * Locking a character (spec §13, §58): once locked, downstream generation
 * (and regeneration of the Character Bible itself) must treat its identity
 * as a hard continuity constraint and never silently rewrite it.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const character = await prisma.character.findUnique({ where: { id: params.id }, include: { project: true } });
    if (!character) throw new Error("NOT_FOUND");
    if (character.project.ownerId !== userId) throw new Error("FORBIDDEN");

    const updated = await prisma.character.update({ where: { id: character.id }, data: { isLocked: true, lockedAt: new Date() } });
    return NextResponse.json({ character: updated });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
