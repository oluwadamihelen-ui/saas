/**
 * Pure eligibility check for publishing a project to Discover (spec's
 * publishing/discovery phase). Publishing must point at a real finished
 * artifact — never a fake/placeholder listing — so a project is only
 * eligible once at least one of its episodes has a successfully rendered
 * full-episode export. Kept separate from the orchestration service so
 * it's unit-testable without a database.
 */
export interface PublishEligibilityExport {
  kind: string;
  status: string;
}

export interface PublishEligibilityEpisode {
  exports: PublishEligibilityExport[];
}

export interface PublishEligibility {
  eligible: boolean;
  reason?: string;
}

export function checkProjectPublishEligibility(episodes: PublishEligibilityEpisode[]): PublishEligibility {
  const hasSucceededExport = episodes.some((episode) =>
    episode.exports.some((exp) => exp.kind === "EPISODE" && exp.status === "SUCCEEDED"),
  );
  if (!hasSucceededExport) {
    return {
      eligible: false,
      reason: "Export at least one finished episode before publishing — Discover only shows real, finished movies.",
    };
  }
  return { eligible: true };
}
