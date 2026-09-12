import type { RiskFactor, StudentPerformanceAnalysis } from "./types";

/// Short, human labels for a risk factor's key — used wherever a table
/// row only has room for one word, e.g. the class risk list's "Main
/// Concern" column. The full sentence lives in risk.reasons; this is
/// just a compact pointer to the same, already-explained factor.
const FACTOR_SHORT_LABEL: Record<string, string> = {
  below_pass_mark: "Below pass mark",
  failed_subjects: "Failed subjects",
  significant_decline: "Performance decline",
  consecutive_decline: "Sustained decline",
  attendance_concern: "Attendance",
  repeated_cbt_practice_struggle: "Practice CBT struggle",
};

function primaryFactor(factors: RiskFactor[]): RiskFactor | null {
  if (factors.length === 0) return null;
  return factors.reduce((biggest, f) => (f.points > biggest.points ? f : biggest));
}

/// The one-line "why" shown in a class/school risk list — the single
/// biggest contributor to this student's risk score, or a positive note
/// when there isn't one. Never invented: derived only from the same
/// factors/success signals the full explanation already shows.
export function mainConcernLabel(analysis: StudentPerformanceAnalysis): string {
  const factor = primaryFactor(analysis.risk.factors);
  if (factor) return FACTOR_SHORT_LABEL[factor.key] ?? factor.reason;
  if (analysis.success.significantImprovement) return "Strong improvement";
  if (analysis.success.consistentHighPerformance) return "Consistent high performance";
  return "No significant concerns";
}
