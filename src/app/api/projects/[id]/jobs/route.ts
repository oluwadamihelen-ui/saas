import { NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { getProjectForUser, ProjectNotFoundError } from "@/server/projects/repository";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    await getProjectForUser(userId, id); // ownership check

    const [project, jobs] = await Promise.all([
      prisma.project.findUnique({
        where: { id },
        select: {
          status: true,
          scenes: {
            orderBy: { order: "asc" },
            select: { id: true, title: true, imageStatus: true, animationStatus: true, voiceStatus: true, status: true },
          },
        },
      }),
      prisma.generationJob.findMany({
        where: { projectId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, stage: true, status: true, error: true, createdAt: true, completedAt: true, sceneId: true },
      }),
    ]);

    return NextResponse.json({ project, jobs });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof ProjectNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw err;
  }
}
