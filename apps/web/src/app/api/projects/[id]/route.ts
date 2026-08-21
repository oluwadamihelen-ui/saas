import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        storyBible: true,
        episodes: { orderBy: { number: "asc" } },
        characters: true,
        locations: true,
        wardrobes: true,
        props: true,
        scenes: { include: { shots: true }, orderBy: { number: "asc" } },
        generationJobs: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
    if (!project) throw new Error("NOT_FOUND");
    if (project.ownerId !== userId) throw new Error("FORBIDDEN");
    return NextResponse.json({ project });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
