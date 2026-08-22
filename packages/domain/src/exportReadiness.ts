/**
 * Pure readiness check for episode export (spec §65: export assembles
 * what's already generated — it must never silently skip a missing shot
 * and ship a broken video). Kept separate from the orchestration service
 * so it's unit-testable without a database.
 */
export interface ExportReadinessShot {
  status: string;
}

export interface ExportReadiness {
  ready: boolean;
  reason?: string;
}

export function checkEpisodeExportReadiness(shots: ExportReadinessShot[]): ExportReadiness {
  if (shots.length === 0) {
    return { ready: false, reason: "This episode has no shots yet — build the storyboard and generate shot videos first." };
  }
  const notReady = shots.filter((s) => s.status !== "READY");
  if (notReady.length > 0) {
    return {
      ready: false,
      reason: `${notReady.length} of ${shots.length} shot${shots.length === 1 ? "" : "s"} haven't finished generating yet. Every shot needs to be ready before you can export the episode.`,
    };
  }
  return { ready: true };
}
