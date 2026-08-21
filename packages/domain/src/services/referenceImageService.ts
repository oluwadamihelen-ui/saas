import { randomUUID } from "node:crypto";
import { prisma } from "@cinerra/database";
import type { ModelRouter } from "@cinerra/ai";
import { ProviderGenerationError, ProviderNotConfiguredError } from "@cinerra/ai";
import type { StorageClient } from "@cinerra/storage";
import { buildAssetKey } from "@cinerra/storage";
import { BASE_NEGATIVE_PROMPT_ITEMS } from "../promptCompiler.js";
import { formatAspectRatio, formatVisualStyle } from "../continuityEngine.js";
import { beginProcessing, transitionGenerationJob, JobCancelledError } from "./jobTransitions.js";

export type ReferenceEntityType = "character" | "location";

export interface StartReferenceImageGenerationParams {
  userId: string;
  entityType: ReferenceEntityType;
  entityId: string;
  enqueue: (generationJobId: string) => Promise<void>;
}

/**
 * Reference image generation (spec §23): Generate Reference → Approve →
 * Lock. Once an entity is locked, its visual identity is authoritative —
 * generating a new reference would silently invalidate every shot that
 * already depends on it, so this refuses rather than doing that quietly.
 */
export async function startReferenceImageGeneration(params: StartReferenceImageGenerationParams): Promise<{ generationJobId: string }> {
  const projectId = await resolveProjectIdAndAssertOwnership(params.entityType, params.entityId, params.userId);

  const job = await prisma.generationJob.create({
    data: {
      userId: params.userId,
      projectId,
      type: "REFERENCE_IMAGE",
      status: "QUEUED",
      input: { entityType: params.entityType, entityId: params.entityId },
    },
  });
  await params.enqueue(job.id);
  return { generationJobId: job.id };
}

async function resolveProjectIdAndAssertOwnership(entityType: ReferenceEntityType, entityId: string, userId: string): Promise<string> {
  if (entityType === "character") {
    const character = await prisma.character.findUniqueOrThrow({ where: { id: entityId }, include: { project: true } });
    if (character.project.ownerId !== userId) throw new Error("You do not have access to this character.");
    if (character.isLocked) throw new Error("This character is locked. Unlock it before generating a new reference image.");
    return character.projectId;
  }
  const location = await prisma.location.findUniqueOrThrow({ where: { id: entityId }, include: { project: true } });
  if (location.project.ownerId !== userId) throw new Error("You do not have access to this location.");
  if (location.isLocked) throw new Error("This location is locked. Unlock it before generating a new reference image.");
  return location.projectId;
}

function buildCharacterPrompt(visualStyle: string, character: { name: string; face: string | null; hair: string | null; eyes: string | null; skin: string | null; build: string | null }): string {
  const details = [character.face, character.hair, character.eyes, character.skin, character.build].filter(Boolean).join(", ");
  return `${visualStyle}, photorealistic character reference portrait of ${character.name}. ${details}. Neutral studio background, front-facing, natural even lighting, high detail, sharp focus — a clean identity reference other shots must match exactly.`;
}

function buildLocationPrompt(visualStyle: string, location: { name: string; architecture: string | null; lighting: string | null; colorPalette: string | null; furniture: string | null }): string {
  const details = [location.architecture, location.lighting, location.colorPalette, location.furniture].filter(Boolean).join(", ");
  return `${visualStyle}, photorealistic architectural reference photo of ${location.name}. ${details}. Wide establishing angle, no people, natural lighting consistent with the described time of day.`;
}

export async function approveCharacterReference(userId: string, referenceId: string): Promise<void> {
  const reference = await prisma.characterReference.findUniqueOrThrow({
    where: { id: referenceId },
    include: { character: { include: { project: true } } },
  });
  if (reference.character.project.ownerId !== userId) throw new Error("You do not have access to this reference.");
  await prisma.characterReference.update({ where: { id: referenceId }, data: { approvedAt: new Date() } });
  await prisma.character.update({ where: { id: reference.characterId }, data: { primaryReferenceId: referenceId } });
}

export async function approveLocationReference(userId: string, referenceId: string): Promise<void> {
  const reference = await prisma.locationReference.findUniqueOrThrow({
    where: { id: referenceId },
    include: { location: { include: { project: true } } },
  });
  if (reference.location.project.ownerId !== userId) throw new Error("You do not have access to this reference.");
  await prisma.locationReference.update({ where: { id: referenceId }, data: { approvedAt: new Date() } });
  await prisma.location.update({ where: { id: reference.locationId }, data: { primaryReferenceId: referenceId } });
}

export async function runReferenceImageGenerationJob(router: ModelRouter, storage: StorageClient, generationJobId: string): Promise<void> {
  const job = await prisma.generationJob.findUniqueOrThrow({ where: { id: generationJobId } });

  try {
    await beginProcessing(job.id);
  } catch (error) {
    if (error instanceof JobCancelledError) return;
    throw error;
  }

  const { entityType, entityId } = job.input as { entityType: ReferenceEntityType; entityId: string };

  try {
    const project = await prisma.project.findUniqueOrThrow({ where: { id: job.projectId } });
    const visualStyle = formatVisualStyle(project.visualStyle, project.customStyle);
    const aspectRatio = formatAspectRatio(project.aspectRatio);

    const prompt =
      entityType === "character"
        ? buildCharacterPrompt(visualStyle, await prisma.character.findUniqueOrThrow({ where: { id: entityId } }))
        : buildLocationPrompt(visualStyle, await prisma.location.findUniqueOrThrow({ where: { id: entityId } }));

    await transitionGenerationJob(job.id, "PROVIDER_GENERATING");
    const result = await router.execute("IMAGE", "BEST_QUALITY", (provider) =>
      provider.generateImage({ prompt, negativePrompt: BASE_NEGATIVE_PROMPT_ITEMS.join(", "), aspectRatio }),
    );

    await transitionGenerationJob(job.id, "DOWNLOADING");
    const assetKey = buildAssetKey({
      projectId: job.projectId,
      kind: entityType === "character" ? "CHARACTER_REFERENCE" : "LOCATION_REFERENCE",
      assetId: randomUUID(),
      ext: "png",
    });
    await storage.downloadAndStore(result.providerUrl, assetKey, "image/png");

    await transitionGenerationJob(job.id, "FINALIZING");

    const asset = await prisma.asset.create({
      data: {
        projectId: job.projectId,
        type: "IMAGE",
        kind: entityType === "character" ? "CHARACTER_REFERENCE" : "LOCATION_REFERENCE",
        storageKey: assetKey,
        mimeType: "image/png",
        sourceProvider: result.meta.provider,
        sourceModel: result.meta.modelId,
      },
    });

    if (entityType === "character") {
      const reference = await prisma.characterReference.create({ data: { characterId: entityId, assetId: asset.id, label: "primary" } });
      const character = await prisma.character.findUniqueOrThrow({ where: { id: entityId } });
      if (!character.primaryReferenceId) {
        await prisma.character.update({ where: { id: entityId }, data: { primaryReferenceId: reference.id } });
      }
    } else {
      const reference = await prisma.locationReference.create({ data: { locationId: entityId, assetId: asset.id, label: "primary" } });
      const location = await prisma.location.findUniqueOrThrow({ where: { id: entityId } });
      if (!location.primaryReferenceId) {
        await prisma.location.update({ where: { id: entityId }, data: { primaryReferenceId: reference.id } });
      }
    }

    await transitionGenerationJob(job.id, "SUCCEEDED");
  } catch (error) {
    const message =
      error instanceof ProviderNotConfiguredError
        ? "Reference image generation isn't available yet — no image provider is configured."
        : error instanceof ProviderGenerationError
          ? "We couldn't generate this reference image right now. Try again shortly."
          : `We couldn't generate this reference image: ${error instanceof Error ? error.message : "unexpected error"}`;
    await transitionGenerationJob(job.id, "FAILED", { errorMessage: message, attempts: { increment: 1 } });
    throw error;
  }
}
