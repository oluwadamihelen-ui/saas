import type { StudentPerformanceMetrics, StudentPerformanceTrend } from "./types";

/// Consistent Decline (brief) needs at least 3 comparable periods — the
/// current one plus two priors — so there are two term-over-term deltas
/// to confirm both point the same way. Fewer than that and a single bad
/// term could be mislabeled a "trend."
const MIN_PERIODS_FOR_CONSISTENT_DECLINE = 3;

/// Pure — `priorMetrics` is already ordered nearest-first (index 0 is the
/// immediately-prior comparable period, per periods.ts's
/// findPriorPeriodsWithData) and already computed by the caller; this
/// function only classifies, never fetches or computes averages itself.
export function computeStudentPerformanceTrend(
  current: StudentPerformanceMetrics,
  priorMetrics: StudentPerformanceMetrics[],
  significantChangePoints: number
): StudentPerformanceTrend {
  const previous = priorMetrics[0] ?? null;

  if (current.overallAverage === null || !previous || previous.overallAverage === null) {
    return { status: "INSUFFICIENT_DATA", current, previous: previous ?? null, changePoints: null, isConsecutiveDecline: false };
  }

  const changePoints = current.overallAverage - previous.overallAverage;

  let status: StudentPerformanceTrend["status"];
  if (changePoints >= significantChangePoints) status = "IMPROVING";
  else if (changePoints <= -significantChangePoints) status = "DECLINING";
  else status = "STABLE";

  const isConsecutiveDecline = computeConsecutiveDecline(current, previous, priorMetrics.slice(1));

  return { status, current, previous, changePoints, isConsecutiveDecline };
}

/// True only when every step across >= MIN_PERIODS_FOR_CONSISTENT_DECLINE
/// periods declined (any negative change counts here, not just a
/// "significant" one — two small consecutive drops are still a pattern
/// worth naming, even if neither alone crosses the significant-change
/// threshold).
function computeConsecutiveDecline(
  current: StudentPerformanceMetrics,
  previous: StudentPerformanceMetrics,
  olderMetrics: StudentPerformanceMetrics[]
): boolean {
  const chain = [current, previous, ...olderMetrics];
  if (chain.length < MIN_PERIODS_FOR_CONSISTENT_DECLINE) return false;

  for (let i = 0; i < MIN_PERIODS_FOR_CONSISTENT_DECLINE - 1; i++) {
    const a = chain[i].overallAverage;
    const b = chain[i + 1].overallAverage;
    if (a === null || b === null || a >= b) return false;
  }
  return true;
}
