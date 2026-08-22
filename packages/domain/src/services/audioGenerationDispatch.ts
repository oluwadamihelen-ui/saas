import { prisma } from "@cinerra/database";
import type { ModelRouter } from "@cinerra/ai";
import type { StorageClient } from "@cinerra/storage";
import { runDialogueGenerationJob } from "./dialogueGenerationService.js";
import { runSoundEffectGenerationJob } from "./soundEffectGenerationService.js";
import { runMusicGenerationJob } from "./musicGenerationService.js";

/**
 * The audio-generation BullMQ queue (packages/queue) is shared across
 * dialogue, sound effect, and music jobs by design (spec §25) — they're
 * all "make an audio clip via a provider, download it, place it on the
 * timeline" and don't warrant separate provider-rate-limit pools the way
 * video does. This dispatcher is the queue's single processor entrypoint,
 * routing to the right per-type service by the persisted job's type.
 */
export async function runAudioGenerationJob(router: ModelRouter, storage: StorageClient, generationJobId: string): Promise<void> {
  const job = await prisma.generationJob.findUniqueOrThrow({ where: { id: generationJobId }, select: { type: true } });
  switch (job.type) {
    case "DIALOGUE_AUDIO":
      return runDialogueGenerationJob(router, storage, generationJobId);
    case "SOUND_EFFECT":
      return runSoundEffectGenerationJob(router, storage, generationJobId);
    case "MUSIC":
      return runMusicGenerationJob(router, storage, generationJobId);
    default:
      throw new Error(`Unsupported audio generation job type: ${job.type}`);
  }
}
