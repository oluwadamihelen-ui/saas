import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const location = await prisma.location.findUnique({ where: { id: params.id }, include: { project: true } });
    if (!location) throw new Error("NOT_FOUND");
    if (location.project.ownerId !== userId) throw new Error("FORBIDDEN");

    const updated = await prisma.location.update({ where: { id: location.id }, data: { isLocked: true, lockedAt: new Date() } });
    return NextResponse.json({ location: updated });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
