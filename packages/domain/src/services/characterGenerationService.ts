import { prisma, chargeForGeneration, refundGenerationCharge, InsufficientGenerationDoeError, AlreadyChargedError } from "@cinerra/database";
import type { ModelRouter } from "@cinerra/ai";
import { ProviderGenerationError, ProviderNotConfiguredError } from "@cinerra/ai";
import { runCharacterDesigner } from "../agents/characterDesigner.js";
import { makeEntityCode } from "../lib/codes.js";
import { linkSceneCharacters } from "./continuityLinking.js";
import { beginProcessing, transitionGenerationJob, JobCancelledError } from "./jobTransitions.js";

export interface StartCharacterGenerationParams {
  userId: string;
  projectId: string;
  enqueue: (generationJobId: string) => Promise<void>;
}

export async function startCharacterGeneration(params: StartCharacterGenerationParams): Promise<{ generationJobId: string }> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: params.projectId } });
  if (project.ownerId !== params.userId) throw new Error("You do not have access to this project.");

  const sceneCount = await prisma.scene.count({ where: { projectId: project.id } });
  if (sceneCount === 0) {
    throw new Error("Generate a screenplay before generating characters — the Character Designer reads the scenes you've written.");
  }

  const job = await prisma.generationJob.create({
    data: { userId: params.userId, projectId: params.projectId, type: "CHARACTER_BIBLE", status: "QUEUED", input: {} },
  });
  await params.enqueue(job.id);
  return { generationJobId: job.id };
}

export async function runCharacterGenerationJob(router: ModelRouter, generationJobId: string): Promise<void> {
  const job = await prisma.generationJob.findUniqueOrThrow({ where: { id: generationJobId } });

  try {
    await beginProcessing(job.id);
  } catch (error) {
    if (error instanceof JobCancelledError) return;
    throw error;
  }

  let charged = false;
  let doeAmount = 0;

  try {
    const platformSettings = await prisma.platformSettings.findUniqueOrThrow({ where: { id: "singleton" } });
    doeAmount = platformSettings.doeCostPerTextGeneration;
    try {
      await prisma.$transaction((tx) =>
        chargeForGeneration(tx, {
          userId: job.userId,
          doeAmount,
          referenceType: "GenerationJob",
          referenceId: job.id,
          idempotencyKey: `generation-spend:${job.id}`,
        }),
      );
      charged = true;
    } catch (chargeError) {
      if (chargeError instanceof AlreadyChargedError) {
        charged = true;
      } else {
        throw chargeError;
      }
    }

    const project = await prisma.project.findUniqueOrThrow({ where: { id: job.projectId }, include: { storyBible: true } });
    const bible = project.storyBible;
    if (!bible) throw new Error("This project has no Story Bible yet.");

    const scenes = await prisma.scene.findMany({ where: { projectId: project.id }, orderBy: { number: "asc" } });
    const screenplayExcerpt = scenes.map((s) => s.scriptText).filter(Boolean).join("\n\n");

    const output = await runCharacterDesigner(router, {
      logline: bible.logline,
      premise: bible.premise,
      world: bible.world ?? "",
      storyRules: (bible.storyRules as string[] | null) ?? [],
      visualStyle: project.visualStyle,
      screenplayExcerpt,
    });

    const existing = await prisma.character.findMany({ where: { projectId: project.id } });
    let nextIndex = existing.length + 1;

    await prisma.$transaction(async (tx) => {
      for (const c of output.characters) {
        const already = existing.find((e) => e.name.toLowerCase() === c.name.toLowerCase());
        const code = already?.code ?? makeEntityCode("CHAR", c.name, nextIndex++);

        const character = await tx.character.upsert({
          where: { projectId_code: { projectId: project.id, code } },
          create: {
            projectId: project.id,
            code,
            name: c.name,
            age: c.age,
            gender: c.gender,
            face: c.face,
            hair: c.hair,
            eyes: c.eyes,
            skin: c.skin,
            height: c.height,
            build: c.build,
            personality: c.personality,
            voiceProfile: c.voiceProfile,
            accent: c.accent,
            characterArc: c.characterArc,
            continuityRules: c.continuityRules,
          },
          update: already?.isLocked
            ? {} // locked characters are never silently rewritten (spec §13)
            : {
                age: c.age,
                gender: c.gender,
                face: c.face,
                hair: c.hair,
                eyes: c.eyes,
                skin: c.skin,
                height: c.height,
                build: c.build,
                personality: c.personality,
                voiceProfile: c.voiceProfile,
                accent: c.accent,
                characterArc: c.characterArc,
                continuityRules: c.continuityRules,
              },
        });

        const existingWardrobe = await tx.wardrobe.findFirst({ where: { characterId: character.id } });
        if (!existingWardrobe?.isLocked) {
          const wardrobeCode = existingWardrobe?.code ?? makeEntityCode("WARD", c.name, 1);
          await tx.wardrobe.upsert({
            where: { projectId_code: { projectId: project.id, code: wardrobeCode } },
            create: {
              projectId: project.id,
              characterId: character.id,
              code: wardrobeCode,
              name: c.defaultWardrobe.name,
              clothing: c.defaultWardrobe.clothing,
              colors: c.defaultWardrobe.colors,
              shoes: c.defaultWardrobe.shoes,
              accessories: c.defaultWardrobe.accessories,
              hairstyle: c.defaultWardrobe.hairstyle,
              makeup: c.defaultWardrobe.makeup,
            },
            update: {
              name: c.defaultWardrobe.name,
              clothing: c.defaultWardrobe.clothing,
              colors: c.defaultWardrobe.colors,
              shoes: c.defaultWardrobe.shoes,
              accessories: c.defaultWardrobe.accessories,
              hairstyle: c.defaultWardrobe.hairstyle,
              makeup: c.defaultWardrobe.makeup,
            },
          });
        }
      }
    });

    await linkSceneCharacters(project.id);
    await transitionGenerationJob(job.id, "SUCCEEDED");
  } catch (error) {
    if (charged) {
      await prisma
        .$transaction((tx) =>
          refundGenerationCharge(tx, { userId: job.userId, doeAmount, referenceType: "GenerationJob", referenceId: job.id }),
        )
        .catch((refundError) => console.error(`[characterGenerationService] failed to refund generation charge for job ${job.id}:`, refundError));
    }
    const message =
      error instanceof InsufficientGenerationDoeError
        ? error.message
        : error instanceof ProviderNotConfiguredError
          ? "Character generation isn't available yet — no language model provider is configured."
          : error instanceof ProviderGenerationError
            ? "We couldn't generate characters right now. Your project is safe — try again shortly."
            : `We couldn't generate characters: ${error instanceof Error ? error.message : "unexpected error"}`;
    await transitionGenerationJob(job.id, "FAILED", { errorMessage: message, attempts: { increment: 1 } });
    throw error;
  }
}
