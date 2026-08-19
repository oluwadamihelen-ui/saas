import { prisma } from "@/server/db/client";
import type { AspectRatio, VisualStyle } from "@/generated/prisma/enums";

export class ProjectNotFoundError extends Error {
  constructor() {
    super("Project not found");
    this.name = "ProjectNotFoundError";
  }
}

/** Every read/write here is scoped to userId — never trust a bare project id from the client. */
export async function listProjectsForUser(userId: string) {
  return prisma.project.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: { scenes: { select: { id: true } } },
  });
}

export async function getProjectForUser(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    include: {
      scenes: {
        orderBy: { order: "asc" },
        include: { characters: { include: { character: true } } },
      },
      characters: { include: { character: true } },
      music: { include: { musicTrack: true } },
    },
  });
  if (!project) throw new ProjectNotFoundError();
  return project;
}

export async function createProjectForUser(
  userId: string,
  data: {
    title: string;
    description?: string;
    idea?: string;
    script?: string;
    aspectRatio?: AspectRatio;
    visualStyle?: VisualStyle;
    language?: string;
    audience?: string;
    targetLengthSeconds?: number;
  }
) {
  return prisma.project.create({
    data: {
      userId,
      title: data.title,
      description: data.description,
      idea: data.idea,
      script: data.script,
      aspectRatio: data.aspectRatio ?? "RATIO_16_9",
      visualStyle: data.visualStyle ?? "MODERN_CARTOON",
      language: data.language ?? "en",
      audience: data.audience,
      targetLengthSeconds: data.targetLengthSeconds,
    },
  });
}

export async function deleteProjectForUser(userId: string, projectId: string) {
  const result = await prisma.project.deleteMany({ where: { id: projectId, userId } });
  if (result.count === 0) throw new ProjectNotFoundError();
}

export async function countProjectsForUser(userId: string) {
  return prisma.project.count({ where: { userId } });
}
