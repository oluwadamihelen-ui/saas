import type { AssignmentParticipationSignal, CbtPracticeSignal } from "./types";
import type { AssignmentTermSummary, CbtPracticeTermSummary } from "./fetchers";

/// Pure. Practice/non-official CBT attempts only — an official attempt
/// already became a Score and is already inside the academic average
/// computed elsewhere in this folder (see fetchers.ts's
/// fetchCbtPracticeSummaries). This is a distinct, clearly-labeled
/// supplementary signal, never merged into overallAverage.
export function computeCbtPracticeSignal(summary: CbtPracticeTermSummary | undefined): CbtPracticeSignal {
  if (!summary || summary.count === 0) {
    return { availability: "INSUFFICIENT_DATA", attemptCount: 0, averagePercentage: null };
  }
  return {
    availability: "AVAILABLE",
    attemptCount: summary.count,
    averagePercentage: Math.round(summary.totalPercentage / summary.count),
  };
}

/// Pure. Completion rate only — never an average of
/// AssignmentSubmission.score, since those aren't normalized to a common
/// maximum across assignments (brief: "do not create misleading
/// percentage comparisons from incompatible scoring scales").
export function computeAssignmentParticipationSignal(summary: AssignmentTermSummary | undefined): AssignmentParticipationSignal {
  if (!summary || summary.total === 0) {
    return { availability: "INSUFFICIENT_DATA", totalAssignments: 0, gradedOrSubmitted: 0, completionRate: null };
  }
  return {
    availability: "AVAILABLE",
    totalAssignments: summary.total,
    gradedOrSubmitted: summary.gradedOrSubmitted,
    completionRate: Math.round((summary.gradedOrSubmitted / summary.total) * 100),
  };
}
