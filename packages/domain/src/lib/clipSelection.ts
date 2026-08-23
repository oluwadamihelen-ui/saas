export interface ClipSelectableShot {
  id: string;
  durationSeconds: number;
}

/**
 * Deterministic clip selection for trailers/social clips: walks the given
 * candidate shots in order, including each one until the cumulative
 * duration reaches the target — never fewer candidates than fit, and
 * stopping as soon as the cap is met rather than trying to land exactly
 * on it. This is intentionally not an "AI picked the best moments" claim;
 * it's a plain deterministic cut. What counts as a "candidate" (e.g. one
 * representative shot per scene) is the caller's decision — this function
 * only decides how many of them fit.
 */
export function selectClipShots<T extends ClipSelectableShot>(candidates: T[], targetDurationSeconds: number): T[] {
  const selected: T[] = [];
  let cumulativeSeconds = 0;
  for (const shot of candidates) {
    if (cumulativeSeconds >= targetDurationSeconds) break;
    selected.push(shot);
    cumulativeSeconds += shot.durationSeconds;
  }
  return selected;
}
