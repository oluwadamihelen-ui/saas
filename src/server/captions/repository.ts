import { prisma } from "@/server/db/client";
import { getSceneForUser, SceneNotFoundError } from "@/server/scenes/repository";

export class CaptionNotFoundError extends Error {
  constructor() {
    super("Caption not found");
    this.name = "CaptionNotFoundError";
  }
}

export async function listCaptionsForUser(userId: string, sceneId: string) {
  await getSceneForUser(userId, sceneId); // ownership check
  return prisma.caption.findMany({ where: { sceneId }, orderBy: { order: "asc" } });
}

export async function addCaptionForUser(userId: string, sceneId: string, data: { text: string; startMs: number; endMs: number }) {
  await getSceneForUser(userId, sceneId);
  const count = await prisma.caption.count({ where: { sceneId } });
  return prisma.caption.create({ data: { sceneId, order: count, ...data } });
}

async function getCaptionForUser(userId: string, captionId: string) {
  const caption = await prisma.caption.findFirst({
    where: { id: captionId, scene: { project: { userId } } },
  });
  if (!caption) throw new CaptionNotFoundError();
  return caption;
}

export async function updateCaptionForUser(userId: string, captionId: string, data: Partial<{ text: string; startMs: number; endMs: number }>) {
  await getCaptionForUser(userId, captionId);
  return prisma.caption.update({ where: { id: captionId }, data });
}

export async function deleteCaptionForUser(userId: string, captionId: string) {
  await getCaptionForUser(userId, captionId);
  await prisma.caption.delete({ where: { id: captionId } });
}

export { SceneNotFoundError };
