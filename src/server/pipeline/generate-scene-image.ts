import { prisma } from "@/server/db/client";
import { getImageProvider } from "@/server/providers";
import { getStorageProvider } from "@/server/storage";
import { applyCreditDelta, InsufficientCreditsError } from "@/server/credits/ledger";
import { CREDIT_COSTS } from "@/lib/plans";

export async function runGenerateSceneImage(sceneId: string) {
  const scene = await prisma.scene.findUniqueOrThrow({
    where: { id: sceneId },
    include: { project: true, characters: { include: { character: true } } },
  });

  const job = await prisma.generationJob.create({
    data: {
      projectId: scene.projectId,
      sceneId,
      stage: "IMAGE",
      provider: getImageProvider().name,
      status: "PROCESSING",
      startedAt: new Date(),
      creditsCost: CREDIT_COSTS.IMAGE_GENERATION,
    },
  });

  await prisma.scene.update({ where: { id: sceneId }, data: { imageStatus: "PROCESSING", status: "GENERATING" } });

  try {
    await applyCreditDelta(scene.project.userId, -CREDIT_COSTS.IMAGE_GENERATION, "IMAGE_GENERATION", { sceneId });

    const asset = await getImageProvider().generateSceneImage({
      prompt: scene.visualPrompt ?? scene.narration ?? scene.title,
      style: scene.project.visualStyle,
      aspectRatio: scene.project.aspectRatio,
      sceneNumber: scene.order + 1,
      sceneTitle: scene.title,
      characterDescriptors: scene.characters.map((sc) => sc.character.visualDescriptor ?? sc.character.name),
    });

    const { url } = await getStorageProvider().put({
      category: "images",
      filename: `scene-${sceneId}.svg`,
      data: asset.buffer,
      contentType: asset.contentType,
    });

    await prisma.scene.update({
      where: { id: sceneId },
      data: { imageUrl: url, imageStatus: "COMPLETED", status: "IMAGE_READY" },
    });

    await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    return { url };
  } catch (err) {
    await prisma.scene.update({ where: { id: sceneId }, data: { imageStatus: "FAILED", status: "FAILED" } });
    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        error: err instanceof InsufficientCreditsError ? "Not enough credits." : errorMessage(err),
      },
    });
    throw err;
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}
