import { prisma } from "@cinerra/database";
import type { ModelRouter } from "@cinerra/ai";
import { ProviderGenerationError, ProviderNotConfiguredError } from "@cinerra/ai";
import { runDirector } from "../agents/director.js";
import { beginProcessing, transitionGenerationJob, JobCancelledError } from "./jobTransitions.js";

export interface StartStoryboardGenerationParams {
  userId: string;
  projectId: string;
  enqueue: (generationJobId: string) => Promise<void>;
}

export async function startStoryboardGeneration(params: StartStoryboardGenerationParams): Promise<{ generationJobId: string }> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: params.projectId } });
  if (project.ownerId !== params.userId) throw new Error("You do not have access to this project.");

  const [characterCount, locationCount] = await Promise.all([
    prisma.character.count({ where: { projectId: project.id } }),
    prisma.location.count({ where: { projectId: project.id } }),
  ]);
  if (characterCount === 0 || locationCount === 0) {
    throw new Error("Generate characters and locations before building the storyboard — the Director agent needs them for continuity.");
  }

  const job = await prisma.generationJob.create({
    data: { userId: params.userId, projectId: params.projectId, type: "STORYBOARD", status: "QUEUED", input: {} },
  });
  await params.enqueue(job.id);
  return { generationJobId: job.id };
}

function normalize(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Director agent (spec §18-19): converts every scene without shots yet into cinematic coverage. */
export async function runStoryboardGenerationJob(router: ModelRouter, generationJobId: string): Promise<void> {
  const job = await prisma.generationJob.findUniqueOrThrow({ where: { id: generationJobId } });

  try {
    await beginProcessing(job.id);
  } catch (error) {
    if (error instanceof JobCancelledError) return;
    throw error;
  }

  try {
    const project = await prisma.project.findUniqueOrThrow({ where: { id: job.projectId } });

    const scenes = await prisma.scene.findMany({
      where: { projectId: project.id, shots: { none: {} } },
      orderBy: { number: "asc" },
      include: {
        location: true,
        characters: { include: { character: { include: { wardrobes: { orderBy: { createdAt: "asc" }, take: 1 } } } } },
      },
    });

    for (const scene of scenes) {
      const characterNames = scene.characters.map((link) => link.character.name);
      const output = await runDirector(router, {
        visualStyle: project.visualStyle,
        intExt: scene.intExt,
        locationName: scene.location?.name ?? scene.rawLocationName ?? "Unspecified location",
        timeOfDay: scene.timeOfDay ?? undefined,
        storyPurpose: scene.storyPurpose ?? undefined,
        emotionalState: scene.emotionalState ?? undefined,
        characterNames,
        scriptText: scene.scriptText ?? "",
      });

      const byNormalizedName = new Map(scene.characters.map((link) => [normalize(link.character.name), link.character]));

      let previousShotId: string | undefined;
      for (const s of output.shots.sort((a, b) => a.order - b.order)) {
        const code = `SC${String(scene.number).padStart(2, "0")}-SH${String(s.order).padStart(3, "0")}`;
        const matchedCharacters = s.characterNames.map((n) => byNormalizedName.get(normalize(n))).filter((c): c is NonNullable<typeof c> => Boolean(c));

        const shot = await prisma.shot.create({
          data: {
            code,
            sceneId: scene.id,
            order: s.order,
            shotType: s.shotType,
            cameraMovement: s.cameraMovement,
            lens: s.lens,
            framing: s.framing,
            eyeLine: s.eyeLine,
            emotion: s.emotion,
            action: s.action,
            dialogue: s.dialogue,
            durationSeconds: s.durationSeconds,
            status: "PENDING",
            previousShotId,
            characters: { create: matchedCharacters.map((c) => ({ characterId: c.id })) },
            wardrobes: {
              create: matchedCharacters
                .map((c) => c.wardrobes[0])
                .filter((w): w is NonNullable<typeof w> => Boolean(w))
                .map((w) => ({ wardrobeId: w.id })),
            },
          },
        });
        previousShotId = shot.id;
      }
    }

    await transitionGenerationJob(job.id, "SUCCEEDED");
  } catch (error) {
    const message =
      error instanceof ProviderNotConfiguredError
        ? "Storyboard generation isn't available yet — no language model provider is configured."
        : error instanceof ProviderGenerationError
          ? "We couldn't generate the storyboard right now. Your project is safe — try again shortly."
          : `We couldn't generate the storyboard: ${error instanceof Error ? error.message : "unexpected error"}`;
    await transitionGenerationJob(job.id, "FAILED", { errorMessage: message, attempts: { increment: 1 } });
    throw error;
  }
}
