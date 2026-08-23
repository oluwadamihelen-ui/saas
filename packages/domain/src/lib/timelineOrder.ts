/**
 * Pure ordering resolution for the timeline editor's manual re-sequencing
 * (spec's timeline editor phase). Callers query shots in the natural
 * scene.number/Shot.order sequence — this decides whether to keep that or
 * apply a creator's manual override, and only does the latter once every
 * shot in the episode actually has one set, so a half-reordered episode
 * (e.g. mid-edit, or shots added after a previous reorder) never produces
 * an ambiguous or partially-applied order.
 */
export interface OrderableShot {
  timelineOrder: number | null;
}

export function resolveEpisodeShotOrder<T extends OrderableShot>(shotsInNaturalOrder: T[]): T[] {
  const allManuallyOrdered = shotsInNaturalOrder.length > 0 && shotsInNaturalOrder.every((s) => s.timelineOrder !== null);
  if (!allManuallyOrdered) return shotsInNaturalOrder;

  return [...shotsInNaturalOrder].sort((a, b) => a.timelineOrder! - b.timelineOrder!);
}
