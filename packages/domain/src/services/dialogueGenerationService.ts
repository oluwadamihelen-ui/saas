import { randomUUID } from "node:crypto";
import { prisma, chargeForGeneration, refundGenerationCharge, InsufficientGenerationDoeError, AlreadyChargedError } from "@cinerra/database";
import type { ModelRouter } from "@cinerra/ai";
import { ProviderGenerationError, ProviderNotConfiguredError } from "@cinerra/ai";
import type { StorageClient } from "@cinerra/storage";
import { buildAssetKey } from "@cinerra/storage";
import { assignDefaultVoiceId } from "../lib/voices.js";
import { beginProcessing, transitionGenerationJob, JobCancelledError } from "./jobTransitions.js";

export interface StartDialogueGenerationParams {
  userId: string;
  shotId: string;
  enqueue: (generationJobId: string) => Promise<void>;
}

/**
 * Dialogue synthesis (spec §28): generates the spoken audio for a shot's
 * dialogue line in the speaking character's voice. Voice identity is
 * assigned once per character and reused on every regeneration
 * (Character.voiceId), so the same character doesn't drift between
 * different-sounding voices across shots.
 */
export async function startDialogueGeneration(params: StartDialogueGenerationParams): Promise<{ generationJobId: string }> {
  const shot = await prisma.shot.findUniqueOrThrow({
    where: { id: params.shotId },
    include: { scene: { include: { project: true } }, characters: { include: { character: true } } },
  });
  if (shot.scene.project.ownerId !== params.userId) throw new Error("You do not have access to this shot.");
  if (!shot.dialogue?.trim()) throw new Error("This shot has no dialogue to generate audio for.");
  if (shot.characters.length === 0) throw new Error("This shot has no character linked to speak the dialogue.");

  const job = await prisma.generationJob.create({
    data: {
      userId: params.userId,
      projectId: shot.scene.projectId,
      shotId: shot.id,
      type: "DIALOGUE_AUDIO",
      status: "QUEUED",
      input: {},
    },
  });
  await params.enqueue(job.id);
  return { generationJobId: job.id };
}

export async function runDialogueGenerationJob(router: ModelRouter, storage: StorageClient, generationJobId: string): Promise<void> {
  const job = await prisma.generationJob.findUniqueOrThrow({ where: { id: generationJobId } });
  if (!job.shotId) throw new Error("Dialogue generation job is missing its shot reference.");

  try {
    await beginProcessing(job.id);
  } catch (error) {
    if (error instanceof JobCancelledError) return;
    throw error;
  }

  let charged = false;
  let doeAmount = 0;

  try {
    const shot = await prisma.shot.findUniqueOrThrow({
      where: { id: job.shotId },
      include: { characters: { include: { character: true } } },
    });
    if (!shot.dialogue?.trim()) throw new Error("This shot has no dialogue to generate audio for.");

    // The speaking character: the sole character on a single-character
    // shot, otherwise the first linked character — the schema doesn't yet
    // track a per-line speaker distinct from "present in the shot".
    const speaker = shot.characters[0]?.character;
    if (!speaker) throw new Error("This shot has no character linked to speak the dialogue.");

    let voiceId = speaker.voiceId;
    if (!voiceId) {
      voiceId = assignDefaultVoiceId(speaker.id, speaker.gender);
      await prisma.character.update({ where: { id: speaker.id }, data: { voiceId } });
    }

    const platformSettings = await prisma.platformSettings.findUniqueOrThrow({ where: { id: "singleton" } });
    doeAmount = Math.ceil(shot.dialogue.length / 100) * platformSettings.doeCostPerVoice100Chars;
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

    await transitionGenerationJob(job.id, "PROVIDER_GENERATING");
    const result = await router.execute("VOICE", "BEST_QUALITY", (provider) =>
      provider.generateVoice({ text: shot.dialogue!, voiceId: voiceId!, emotion: shot.emotion ?? undefined }),
    );

    await transitionGenerationJob(job.id, "DOWNLOADING");
    const assetKey = buildAssetKey({ projectId: job.projectId, kind: "GENERATED_AUDIO", assetId: randomUUID(), ext: "mp3" });
    await storage.downloadAndStore(result.providerUrl, assetKey, "audio/mpeg");

    await transitionGenerationJob(job.id, "FINALIZING");
    const asset = await prisma.asset.create({
      data: {
        projectId: job.projectId,
        type: "AUDIO",
        kind: "GENERATED_AUDIO",
        storageKey: assetKey,
        mimeType: "audio/mpeg",
        sourceProvider: result.meta.provider,
        sourceModel: result.meta.modelId,
      },
    });

    const audioItem = await prisma.audioItem.create({
      data: { projectId: job.projectId, type: "DIALOGUE", assetId: asset.id, characterId: speaker.id, text: shot.dialogue },
    });

    // Records the dialogue's place on the timeline against this shot even
    // though the full timeline editor UI doesn't exist yet — the join
    // this creates is exactly what that editor will read from later.
    await prisma.timelineItem.upsert({
      where: { id: `${shot.id}-dialogue` }, // deterministic id keeps this idempotent across regenerations
      create: {
        id: `${shot.id}-dialogue`,
        projectId: job.projectId,
        track: "DIALOGUE",
        shotId: shot.id,
        audioItemId: audioItem.id,
        startSeconds: 0,
        endSeconds: shot.durationSeconds,
      },
      update: { audioItemId: audioItem.id, endSeconds: shot.durationSeconds },
    });

    await transitionGenerationJob(job.id, "SUCCEEDED");
  } catch (error) {
    if (charged) {
      await prisma
        .$transaction((tx) =>
          refundGenerationCharge(tx, { userId: job.userId, doeAmount, referenceType: "GenerationJob", referenceId: job.id }),
        )
        .catch((refundError) => console.error(`[dialogueGenerationService] failed to refund generation charge for job ${job.id}:`, refundError));
    }
    const message =
      error instanceof InsufficientGenerationDoeError
        ? error.message
        : error instanceof ProviderNotConfiguredError
          ? "Dialogue generation isn't available yet — no voice provider is configured. Add an AI provider API key in Settings."
          : error instanceof ProviderGenerationError
            ? "We couldn't generate this dialogue audio right now. Your project is safe — try again shortly."
            : `We couldn't generate this dialogue audio: ${error instanceof Error ? error.message : "unexpected error"}`;
    await transitionGenerationJob(job.id, "FAILED", { errorMessage: message, attempts: { increment: 1 } });
    throw error;
  }
}
