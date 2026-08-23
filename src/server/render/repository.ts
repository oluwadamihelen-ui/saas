import { prisma } from "@/server/db/client";
import { ProjectNotFoundError } from "@/server/projects/repository";
import type { RenderResolution } from "@/generated/prisma/enums";

export async function createRenderJobForUser(userId: string, projectId: string, resolution: RenderResolution) {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) throw new ProjectNotFoundError();

  return prisma.renderJob.create({
    data: {
      projectId,
      resolution,
      aspectRatio: project.aspectRatio,
      status: "QUEUED",
    },
  });
}

export async function getLatestRenderJobForUser(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) throw new ProjectNotFoundError();

  return prisma.renderJob.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
}

export { ProjectNotFoundError };
