import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@cinerra/database";
import type { StorageClient } from "@cinerra/storage";
import { addSilentAudioTrack, mixAudioTracks, muxAudioOntoVideo, overlayMusic } from "@cinerra/media";

/**
 * Shared FFmpeg assembly steps used by both full episode export and
 * trailer/social-clip generation — the only real difference between them
 * is which shots get passed in (all of them, vs. a selected subset).
 */

export interface AssemblableShot {
  videoAsset: { storageKey: string } | null;
  timelineItems: Array<{ track: string; audioItem: { asset: { storageKey: string } } | null }>;
}

export async function downloadToFile(storage: StorageClient, storageKey: string, localPath: string): Promise<void> {
  const url = await storage.getSignedDownloadUrl(storageKey, 3600);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download asset for assembly (${response.status}).`);
  await writeFile(localPath, Buffer.from(await response.arrayBuffer()));
}

/**
 * Downloads each shot's video plus its dialogue/SFX audio (mixed together
 * if both exist, or synthesized as silence if neither does), muxes that
 * onto the shot's video, and returns the prepared segment paths in order
 * — ready for `concatVideos`. Does not concatenate itself, so the caller
 * controls exactly when the job transitions to FINALIZING relative to it.
 */
export async function prepareShotSegments(storage: StorageClient, workDir: string, shots: AssemblableShot[]): Promise<string[]> {
  const preparedSegments: string[] = [];
  let index = 0;
  for (const shot of shots) {
    const videoAsset = shot.videoAsset!; // guaranteed by the caller's readiness check
    const videoPath = join(workDir, `shot-${index}.mp4`);
    await downloadToFile(storage, videoAsset.storageKey, videoPath);

    const dialogueAsset = shot.timelineItems.find((t) => t.track === "DIALOGUE")?.audioItem?.asset;
    const sfxAsset = shot.timelineItems.find((t) => t.track === "SFX")?.audioItem?.asset;
    const preparedPath = join(workDir, `prepared-${index}.mp4`);

    const audioPaths: string[] = [];
    if (dialogueAsset) {
      const path = join(workDir, `dialogue-${index}.mp3`);
      await downloadToFile(storage, dialogueAsset.storageKey, path);
      audioPaths.push(path);
    }
    if (sfxAsset) {
      const path = join(workDir, `sfx-${index}.mp3`);
      await downloadToFile(storage, sfxAsset.storageKey, path);
      audioPaths.push(path);
    }

    if (audioPaths.length === 0) {
      await addSilentAudioTrack(videoPath, preparedPath);
    } else if (audioPaths.length === 1) {
      await muxAudioOntoVideo(videoPath, audioPaths[0]!, preparedPath);
    } else {
      const mixedPath = join(workDir, `mixed-${index}.mp3`);
      await mixAudioTracks(audioPaths, mixedPath);
      await muxAudioOntoVideo(videoPath, mixedPath, preparedPath);
    }
    preparedSegments.push(preparedPath);
    index++;
  }
  return preparedSegments;
}

/** Overlays the episode's generated score onto an already-assembled video, if one exists. Returns the input path unchanged when there's no score. */
export async function overlayEpisodeMusicIfAny(storage: StorageClient, workDir: string, episodeId: string, concatenatedPath: string): Promise<string> {
  const musicTimelineItem = await prisma.timelineItem.findFirst({
    where: { episodeId, track: "MUSIC" },
    include: { audioItem: { include: { asset: true } } },
  });
  const musicAsset = musicTimelineItem?.audioItem?.asset;
  if (!musicAsset) return concatenatedPath;

  const musicPath = join(workDir, "music.mp3");
  await downloadToFile(storage, musicAsset.storageKey, musicPath);
  const finalPath = join(workDir, "final.mp4");
  await overlayMusic(concatenatedPath, musicPath, finalPath);
  return finalPath;
}
