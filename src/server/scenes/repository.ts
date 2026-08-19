import { prisma } from "@/server/db/client";

export class SceneNotFoundError extends Error {
  constructor() {
    super("Scene not found");
    this.name = "SceneNotFoundError";
  }
}

/** Scenes have no userId of their own — ownership always flows through project.userId. */
export async function getSceneForUser(userId: string, sceneId: string) {
  const scene = await prisma.scene.findFirst({
    where: { id: sceneId, project: { userId } },
    include: { project: true, characters: { include: { character: true } } },
  });
  if (!scene) throw new SceneNotFoundError();
  return scene;
}

export async function updateSceneForUser(
  userId: string,
  sceneId: string,
  data: Partial<{
    title: string;
    narration: string;
    visualPrompt: string;
    location: string;
    camera: string;
    transition: string;
    durationSeconds: number;
  }>
) {
  await getSceneForUser(userId, sceneId);
  return prisma.scene.update({ where: { id: sceneId }, data });
}

export async function deleteSceneForUser(userId: string, sceneId: string) {
  const scene = await getSceneForUser(userId, sceneId);
  await prisma.scene.delete({ where: { id: sceneId } });

  // Re-pack order values so scenes stay contiguous (0..n-1) after a delete.
  const remaining = await prisma.scene.findMany({
    where: { projectId: scene.projectId },
    orderBy: { order: "asc" },
  });
  await Promise.all(
    remaining.map((s, i) => (s.order === i ? null : prisma.scene.update({ where: { id: s.id }, data: { order: i } })))
  );
}

export async function duplicateSceneForUser(userId: string, sceneId: string) {
  const scene = await getSceneForUser(userId, sceneId);

  await prisma.scene.updateMany({
    where: { projectId: scene.projectId, order: { gt: scene.order } },
    data: { order: { increment: 1 } },
  });

  const copy = await prisma.scene.create({
    data: {
      projectId: scene.projectId,
      order: scene.order + 1,
      title: `${scene.title} (copy)`,
      narration: scene.narration,
      visualPrompt: scene.visualPrompt,
      location: scene.location,
      camera: scene.camera,
      transition: scene.transition,
      durationSeconds: scene.durationSeconds,
      status: "DRAFT",
    },
  });

  for (const sc of scene.characters) {
    await prisma.sceneCharacter.create({ data: { sceneId: copy.id, characterId: sc.characterId } });
  }

  return copy;
}

export async function addSceneForUser(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) throw new SceneNotFoundError();

  const count = await prisma.scene.count({ where: { projectId } });

  return prisma.scene.create({
    data: {
      projectId,
      order: count,
      title: `Scene ${count + 1}`,
      durationSeconds: 6,
      status: "DRAFT",
    },
  });
}

export async function moveSceneForUser(userId: string, sceneId: string, direction: "up" | "down") {
  const scene = await getSceneForUser(userId, sceneId);

  const neighbor = await prisma.scene.findFirst({
    where: {
      projectId: scene.projectId,
      order: direction === "up" ? scene.order - 1 : scene.order + 1,
    },
  });
  if (!neighbor) return; // already at the boundary

  await prisma.$transaction([
    prisma.scene.update({ where: { id: scene.id }, data: { order: neighbor.order } }),
    prisma.scene.update({ where: { id: neighbor.id }, data: { order: scene.order } }),
  ]);
}

export async function reorderScenesForUser(userId: string, projectId: string, orderedSceneIds: string[]) {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) throw new SceneNotFoundError();

  const scenes = await prisma.scene.findMany({ where: { projectId }, select: { id: true } });
  const validIds = new Set(scenes.map((s) => s.id));
  if (orderedSceneIds.length !== scenes.length || orderedSceneIds.some((id) => !validIds.has(id))) {
    throw new Error("Reorder list must contain exactly the project's current scene ids.");
  }

  await Promise.all(
    orderedSceneIds.map((id, index) => prisma.scene.update({ where: { id }, data: { order: index } }))
  );
}
