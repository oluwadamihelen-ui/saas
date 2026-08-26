import { prisma, chargeForGeneration, refundGenerationCharge, InsufficientGenerationDoeError, AlreadyChargedError } from "@cinerra/database";
import type { ModelRouter } from "@cinerra/ai";
import { ProviderGenerationError, ProviderNotConfiguredError } from "@cinerra/ai";
import { runPropDesigner } from "../agents/propDesigner.js";
import { makeEntityCode } from "../lib/codes.js";
import { beginProcessing, transitionGenerationJob, JobCancelledError } from "./jobTransitions.js";

export interface StartPropGenerationParams {
  userId: string;
  projectId: string;
  enqueue: (generationJobId: string) => Promise<void>;
}

export async function startPropGeneration(params: StartPropGenerationParams): Promise<{ generationJobId: string }> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: params.projectId } });
  if (project.ownerId !== params.userId) throw new Error("You do not have access to this project.");

  const sceneCount = await prisma.scene.count({ where: { projectId: project.id } });
  if (sceneCount === 0) {
    throw new Error("Generate a screenplay before generating props — the Prop Designer reads the scenes you've written.");
  }

  const job = await prisma.generationJob.create({
    data: { userId: params.userId, projectId: params.projectId, type: "PROP_BIBLE", status: "QUEUED", input: {} },
  });
  await params.enqueue(job.id);
  return { generationJobId: job.id };
}

function normalize(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function runPropGenerationJob(router: ModelRouter, generationJobId: string): Promise<void> {
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

    const project = await prisma.project.findUniqueOrThrow({ where: { id: job.projectId } });
    const [scenes, characters] = await Promise.all([
      prisma.scene.findMany({ where: { projectId: project.id }, orderBy: { number: "asc" } }),
      prisma.character.findMany({ where: { projectId: project.id } }),
    ]);
    const screenplayExcerpt = scenes.map((s) => s.scriptText).filter(Boolean).join("\n\n");
    if (!screenplayExcerpt.trim()) throw new Error("This project's screenplay has no text yet.");

    const output = await runPropDesigner(router, {
      visualStyle: project.visualStyle,
      characterNames: characters.map((c) => c.name),
      screenplayExcerpt,
    });

    const byNormalizedCharacterName = new Map(characters.map((c) => [normalize(c.name), c]));
    const existing = await prisma.prop.findMany({ where: { projectId: project.id } });
    let nextIndex = existing.length + 1;

    await prisma.$transaction(async (tx) => {
      for (const p of output.props) {
        const already = existing.find((e) => e.name.toLowerCase() === p.name.toLowerCase());
        const owner = p.ownerCharacterName ? byNormalizedCharacterName.get(normalize(p.ownerCharacterName)) : undefined;
        const code = already?.code ?? makeEntityCode("PROP", p.name, nextIndex++);

        await tx.prop.upsert({
          where: { projectId_code: { projectId: project.id, code } },
          create: {
            projectId: project.id,
            code,
            name: p.name,
            description: p.description,
            continuityNotes: p.continuityNotes,
            ownerCharacterId: owner?.id,
          },
          update: already?.isLocked
            ? {} // locked props are never silently rewritten, same as characters/locations (spec §14, §58)
            : {
                description: p.description,
                continuityNotes: p.continuityNotes,
                ownerCharacterId: owner?.id,
              },
        });
      }
    });

    await transitionGenerationJob(job.id, "SUCCEEDED");
  } catch (error) {
    if (charged) {
      await prisma
        .$transaction((tx) =>
          refundGenerationCharge(tx, { userId: job.userId, doeAmount, referenceType: "GenerationJob", referenceId: job.id }),
        )
        .catch((refundError) => console.error(`[propGenerationService] failed to refund generation charge for job ${job.id}:`, refundError));
    }
    const message =
      error instanceof InsufficientGenerationDoeError
        ? error.message
        : error instanceof ProviderNotConfiguredError
          ? "Prop generation isn't available yet — no language model provider is configured."
          : error instanceof ProviderGenerationError
            ? "We couldn't generate props right now. Your project is safe — try again shortly."
            : `We couldn't generate props: ${error instanceof Error ? error.message : "unexpected error"}`;
    await transitionGenerationJob(job.id, "FAILED", { errorMessage: message, attempts: { increment: 1 } });
    throw error;
  }
}
