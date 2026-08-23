import { prisma } from "@cinerra/database";
import { resolveEpisodeShotOrder } from "../lib/timelineOrder.js";

export interface TimelineMixDTO {
  timelineItemId: string;
  volume: number;
  muted: boolean;
}

export interface TimelineShotDTO {
  id: string;
  code: string;
  action: string | null;
  durationSeconds: number;
  dialogue: TimelineMixDTO | null;
  sfx: TimelineMixDTO | null;
}

export interface TimelineDTO {
  episodeId: string;
  episodeTitle: string;
  shots: TimelineShotDTO[];
  music: TimelineMixDTO | null;
}

function toMixDTO(item: { id: string; volume: number; muted: boolean } | undefined): TimelineMixDTO | null {
  return item ? { timelineItemId: item.id, volume: item.volume, muted: item.muted } : null;
}

/**
 * Loads an episode's timeline editor state: its shots in playback order
 * (natural scene/shot order, or a creator's manual re-sequencing once it's
 * fully applied — see resolveEpisodeShotOrder), plus each shot's
 * dialogue/SFX volume-and-mute state and the episode's background score,
 * where those tracks exist. A shot with no generated dialogue/SFX simply
 * has no mix control to show — never a fabricated default.
 */
export async function getEpisodeTimeline(params: { userId: string; episodeId: string }): Promise<TimelineDTO> {
  const episode = await prisma.episode.findUnique({
    where: { id: params.episodeId },
    include: {
      project: true,
      scenes: {
        orderBy: { number: "asc" },
        include: {
          shots: {
            orderBy: { order: "asc" },
            include: { timelineItems: { where: { track: { in: ["DIALOGUE", "SFX"] } } } },
          },
        },
      },
      timelineItems: { where: { track: "MUSIC" } },
    },
  });
  if (!episode) throw new Error("NOT_FOUND");
  if (episode.project.ownerId !== params.userId) throw new Error("FORBIDDEN");

  const orderedShots = resolveEpisodeShotOrder(episode.scenes.flatMap((s) => s.shots));

  const shots: TimelineShotDTO[] = orderedShots.map((shot) => ({
    id: shot.id,
    code: shot.code,
    action: shot.action,
    durationSeconds: shot.durationSeconds,
    dialogue: toMixDTO(shot.timelineItems.find((t) => t.track === "DIALOGUE")),
    sfx: toMixDTO(shot.timelineItems.find((t) => t.track === "SFX")),
  }));

  return {
    episodeId: episode.id,
    episodeTitle: episode.title,
    shots,
    music: toMixDTO(episode.timelineItems[0]),
  };
}

/** Persists a creator's manual drag-and-drop re-sequencing of an episode's shots. */
export async function reorderEpisodeShots(params: { userId: string; episodeId: string; orderedShotIds: string[] }): Promise<void> {
  const episode = await prisma.episode.findUnique({
    where: { id: params.episodeId },
    include: { project: true, scenes: { include: { shots: { select: { id: true } } } } },
  });
  if (!episode) throw new Error("NOT_FOUND");
  if (episode.project.ownerId !== params.userId) throw new Error("FORBIDDEN");

  const actualIds = new Set(episode.scenes.flatMap((s) => s.shots.map((sh) => sh.id)));
  const requestedIds = params.orderedShotIds;
  const sameSet = actualIds.size === requestedIds.length && requestedIds.every((id) => actualIds.has(id));
  if (!sameSet) {
    throw new Error("The provided shot order doesn't match this episode's shots.");
  }

  await prisma.$transaction(
    requestedIds.map((shotId, index) => prisma.shot.update({ where: { id: shotId }, data: { timelineOrder: index } })),
  );
}

function clampVolume(volume: number): number {
  return Math.min(2, Math.max(0, volume));
}

/** Updates a single timeline item's volume/mute — the editor's per-track dialogue/SFX/score mix control. */
export async function updateTimelineItemMix(params: { userId: string; timelineItemId: string; volume?: number; muted?: boolean }) {
  const item = await prisma.timelineItem.findUnique({ where: { id: params.timelineItemId }, include: { project: true } });
  if (!item) throw new Error("NOT_FOUND");
  if (item.project.ownerId !== params.userId) throw new Error("FORBIDDEN");

  return prisma.timelineItem.update({
    where: { id: item.id },
    data: {
      ...(params.volume !== undefined ? { volume: clampVolume(params.volume) } : {}),
      ...(params.muted !== undefined ? { muted: params.muted } : {}),
    },
  });
}
