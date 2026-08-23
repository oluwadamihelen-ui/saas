import { prisma } from "@/server/db/client";
import { getVoiceProvider } from "@/server/providers";
import { getStorageProvider } from "@/server/storage";
import { applyCreditDelta, InsufficientCreditsError } from "@/server/credits/ledger";
import { CREDIT_COSTS } from "@/lib/plans";
import { runGenerateCaptions } from "./generate-captions";

export async function runGenerateSceneVoice(sceneId: string) {
  const scene = await prisma.scene.findUniqueOrThrow({
    where: { id: sceneId },
    include: { project: true, voicePreset: true },
  });

  const job = await prisma.generationJob.create({
    data: {
      projectId: scene.projectId,
      sceneId,
      stage: "VOICE",
      provider: getVoiceProvider().name,
      status: "PROCESSING",
      startedAt: new Date(),
      creditsCost: CREDIT_COSTS.VOICE_GENERATION,
    },
  });

  await prisma.scene.update({ where: { id: sceneId }, data: { voiceStatus: "PROCESSING" } });

  try {
    if (!scene.narration?.trim()) {
      throw new Error("This scene has no narration text to generate voice from.");
    }

    await applyCreditDelta(scene.project.userId, -CREDIT_COSTS.VOICE_GENERATION, "VOICE_GENERATION", { sceneId });

    const asset = await getVoiceProvider().synthesize({
      text: scene.narration,
      style: scene.voicePreset?.style ?? "FRIENDLY",
      language: scene.voicePreset?.language ?? scene.project.language,
      accent: scene.voicePreset?.accent ?? undefined,
      speed: scene.voiceSpeed ?? 1,
      pitch: scene.voicePitch ?? 1,
    });

    const { url } = await getStorageProvider().put({
      category: "audio",
      filename: `scene-${sceneId}-voice.wav`,
      data: asset.buffer,
      contentType: asset.contentType,
    });

    await prisma.scene.update({
      where: { id: sceneId },
      data: { voiceUrl: url, voiceDurationSeconds: asset.durationSeconds, voiceStatus: "COMPLETED" },
    });

    await runGenerateCaptions(sceneId, asset.durationSeconds);

    await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    return { url, durationSeconds: asset.durationSeconds };
  } catch (err) {
    await prisma.scene.update({ where: { id: sceneId }, data: { voiceStatus: "FAILED" } });
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
