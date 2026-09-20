import type { PerformancePeriod, StudentPerformanceMetrics, SubjectPerformanceRow } from "./types";

/// Pure computation — no I/O. Builds one student's metrics for one term
/// from data the caller has already fetched (fetchers.ts), so the same
/// function serves the single-student page and a 100-student class
/// dashboard without either doing its own database round-trip.
export function computeStudentPerformanceMetrics(
  studentId: string,
  period: PerformancePeriod,
  scoresBySubject: Map<string, { subjectName: string; total: number }> | undefined,
  classArmId: string | null,
  maxTotal: number,
  passMark: number
): StudentPerformanceMetrics {
  const subjects: SubjectPerformanceRow[] = [];
  if (scoresBySubject && maxTotal > 0) {
    for (const [subjectId, { subjectName, total }] of scoresBySubject) {
      const percentage = Math.round((total / maxTotal) * 100);
      subjects.push({ subjectId, subjectName, percentage, isPassing: percentage >= passMark });
    }
    subjects.sort((a, b) => a.subjectName.localeCompare(b.subjectName));
  }

  const overallAverage =
    subjects.length > 0 ? Math.round(subjects.reduce((sum, s) => sum + s.percentage, 0) / subjects.length) : null;

  return {
    studentId,
    period,
    classArmId,
    subjects,
    overallAverage,
    subjectsPassed: subjects.filter((s) => s.isPassing).length,
    subjectsFailed: subjects.filter((s) => !s.isPassing).length,
  };
}
