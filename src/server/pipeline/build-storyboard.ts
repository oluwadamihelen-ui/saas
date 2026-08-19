import { prisma } from "@/server/db/client";
import { getAIProvider } from "@/server/providers";
import { applyCreditDelta, InsufficientCreditsError } from "@/server/credits/ledger";
import { CREDIT_COSTS } from "@/lib/plans";

export async function runBuildStoryboard(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });

  const job = await prisma.generationJob.create({
    data: {
      projectId,
      stage: "STORYBOARD",
      provider: getAIProvider().name,
      status: "PROCESSING",
      startedAt: new Date(),
      creditsCost: CREDIT_COSTS.STORYBOARD_GENERATION,
    },
  });

  try {
    await applyCreditDelta(project.userId, -CREDIT_COSTS.STORYBOARD_GENERATION, "STORYBOARD_GENERATION", { projectId });

    const result = await getAIProvider().generateStoryboard({
      idea: project.idea ?? undefined,
      script: project.script ?? undefined,
      style: project.visualStyle,
      language: project.language,
      targetLengthSeconds: project.targetLengthSeconds ?? undefined,
    });

    // Resolve each extracted character to an existing one (by name, case-insensitive)
    // or create a new one — this is the reuse-vs-create step behind character consistency.
    const nameToCharacterId = new Map<string, string>();
    for (const c of result.characters) {
      const existing = await prisma.character.findFirst({
        where: { userId: project.userId, name: { equals: c.name, mode: "insensitive" } },
      });

      if (existing) {
        nameToCharacterId.set(c.name, existing.id);
      } else {
        const created = await prisma.character.create({
          data: {
            userId: project.userId,
            name: c.name,
            appearance: c.appearance,
            personality: c.personality,
            visualDescriptor: `${c.name} — ${c.appearance}`,
          },
        });
        nameToCharacterId.set(c.name, created.id);
      }

      await prisma.projectCharacter.upsert({
        where: { projectId_characterId: { projectId, characterId: nameToCharacterId.get(c.name)! } },
        create: { projectId, characterId: nameToCharacterId.get(c.name)! },
        update: {},
      });
    }

    // Replace any existing scenes for this project (a fresh storyboard generation).
    await prisma.scene.deleteMany({ where: { projectId } });

    for (let i = 0; i < result.scenes.length; i++) {
      const s = result.scenes[i];
      const scene = await prisma.scene.create({
        data: {
          projectId,
          order: i,
          title: s.title,
          narration: s.narration,
          visualPrompt: s.visualPrompt,
          location: s.location,
          camera: s.camera,
          transition: s.transition,
          durationSeconds: s.durationSeconds,
          status: "DRAFT",
        },
      });

      for (const characterName of s.characterNames) {
        const characterId = nameToCharacterId.get(characterName);
        if (characterId) {
          await prisma.sceneCharacter.create({ data: { sceneId: scene.id, characterId } });
        }
      }
    }

    await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    await prisma.project.update({ where: { id: projectId }, data: { status: "STORYBOARD_READY" } });

    return result;
  } catch (err) {
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
