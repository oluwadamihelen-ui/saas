import type { StudentPerformanceMetrics, SubjectPerformanceAnalysis, SubjectTrendRow, SubjectTrendStatus } from "./types";

/// Strongest/weakest only mean something when there's more than one
/// subject to compare (brief: "Strongest Subject: Requires actual scores
/// in multiple subjects").
const MIN_SUBJECTS_FOR_STRONGEST_WEAKEST = 2;

/// Pure. `current`/`previous` are already-computed metrics for the same
/// student across two comparable periods (previous may be null —
/// per-subject trend then falls back to INSUFFICIENT_DATA per subject,
/// while current-period subject totals themselves are still shown).
export function computeSubjectPerformanceAnalysis(
  current: StudentPerformanceMetrics,
  previous: StudentPerformanceMetrics | null,
  significantChangePoints: number
): SubjectPerformanceAnalysis {
  if (current.subjects.length === 0) {
    return {
      availability: "INSUFFICIENT_DATA",
      subjects: [],
      strongestSubject: null,
      weakestSubject: null,
      mostImprovedSubject: null,
      mostDeclinedSubject: null,
    };
  }

  const previousBySubject = new Map((previous?.subjects ?? []).map((s) => [s.subjectId, s.percentage]));

  const subjects: SubjectTrendRow[] = current.subjects.map((s) => {
    const prev = previousBySubject.get(s.subjectId) ?? null;
    const changePoints = prev === null ? null : s.percentage - prev;
    let status: SubjectTrendStatus;
    if (changePoints === null) status = "INSUFFICIENT_DATA";
    else if (changePoints >= significantChangePoints) status = "IMPROVING";
    else if (changePoints <= -significantChangePoints) status = "NEEDS_ATTENTION";
    else status = "STABLE";

    return { subjectId: s.subjectId, subjectName: s.subjectName, current: s.percentage, previous: prev, changePoints, status };
  });

  const strongestSubject =
    subjects.length >= MIN_SUBJECTS_FOR_STRONGEST_WEAKEST
      ? subjects.reduce((best, s) => (s.current > best.current ? s : best))
      : null;
  const weakestSubject =
    subjects.length >= MIN_SUBJECTS_FOR_STRONGEST_WEAKEST
      ? subjects.reduce((worst, s) => (s.current < worst.current ? s : worst))
      : null;

  const withChange = subjects.filter((s) => s.changePoints !== null);
  const mostImprovedSubject =
    withChange.length > 0
      ? withChange.reduce((best, s) => (s.changePoints! > best.changePoints! ? s : best))
      : null;
  const mostDeclinedSubject =
    withChange.length > 0
      ? withChange.reduce((worst, s) => (s.changePoints! < worst.changePoints! ? s : worst))
      : null;

  return {
    availability: "AVAILABLE",
    subjects,
    strongestSubject,
    weakestSubject,
    // Only surface these as genuine signals when the change is actually
    // meaningful — a "most improved" subject that only moved 1 point
    // isn't a signal worth naming.
    mostImprovedSubject: mostImprovedSubject && mostImprovedSubject.changePoints! > 0 ? mostImprovedSubject : null,
    mostDeclinedSubject: mostDeclinedSubject && mostDeclinedSubject.changePoints! < 0 ? mostDeclinedSubject : null,
  };
}
