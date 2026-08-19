import { prisma } from "@/server/db/client";
import { runScriptAnalysis } from "./analyze-script";
import { runBuildStoryboard } from "./build-storyboard";

/** Script analysis + storyboard generation. Scene images are fanned out separately by the worker. */
export async function runProjectGeneration(projectId: string) {
  await prisma.project.update({ where: { id: projectId }, data: { status: "GENERATING" } });

  await runScriptAnalysis(projectId);
  await runBuildStoryboard(projectId);

  const scenes = await prisma.scene.findMany({ where: { projectId }, select: { id: true } });
  return scenes.map((s) => s.id);
}

export async function markProjectReadyIfComplete(projectId: string) {
  const pendingImages = await prisma.scene.count({
    where: { projectId, imageStatus: { in: ["PENDING", "QUEUED", "PROCESSING"] } },
  });

  if (pendingImages === 0) {
    await prisma.project.update({ where: { id: projectId }, data: { status: "READY_TO_EDIT" } });
  }
}
