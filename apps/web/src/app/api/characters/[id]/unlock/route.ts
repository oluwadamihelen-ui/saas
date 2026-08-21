import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const character = await prisma.character.findUnique({ where: { id: params.id }, include: { project: true } });
    if (!character) throw new Error("NOT_FOUND");
    if (character.project.ownerId !== userId) throw new Error("FORBIDDEN");

    const updated = await prisma.character.update({ where: { id: character.id }, data: { isLocked: false, lockedAt: null } });
    return NextResponse.json({ character: updated });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
