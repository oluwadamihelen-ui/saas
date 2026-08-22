import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";

/** Locking a prop (spec §16, §58): once locked, a prop's identity is a hard continuity constraint the Prop Designer must never silently rewrite. */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const prop = await prisma.prop.findUnique({ where: { id: params.id }, include: { project: true } });
    if (!prop) throw new Error("NOT_FOUND");
    if (prop.project.ownerId !== userId) throw new Error("FORBIDDEN");

    const updated = await prisma.prop.update({ where: { id: prop.id }, data: { isLocked: true } });
    return NextResponse.json({ prop: updated });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
