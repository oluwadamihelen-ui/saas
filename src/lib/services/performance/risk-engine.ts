import type {
  AttendancePerformanceAnalysis,
  CbtPracticeSignal,
  PerformanceThresholds,
  RiskFactor,
  RiskLevel,
  StudentPerformanceTrend,
  StudentRiskAssessment,
  StudentSuccessSignals,
  SubjectPerformanceAnalysis,
} from "./types";

// ---------------------------------------------------------------------
// Explainable, rule-based Student Risk Engine.
//
// No black box, no AI: every point on the score is traceable to one
// named factor with a plain-language reason built from the school's own
// configured thresholds and this student's own numbers — never a vague
// "AI thinks this student is high risk." AI (Phase 11) reads this
// output afterward to write prose; it never computes riskLevel itself.
//
// Each factor fires independently, only when its own data is actually
// available (a missing attendance record contributes nothing — neither
// positive nor negative — never treated as "poor attendance"). Points
// are summed into riskScore, then mapped to a level by the fixed bands
// below. The exact weights are a first-version judgment call, not
// derived from any statistical model; they're deliberately simple
// enough that a school administrator can re-derive the score by hand
// from the reasons list alone.
// ---------------------------------------------------------------------

const WEIGHT_BELOW_PASS_MARK = 30;
const WEIGHT_PER_FAILED_SUBJECT = 8;
const WEIGHT_FAILED_SUBJECTS_CAP = 40;
const WEIGHT_SIGNIFICANT_DECLINE = 25;
const WEIGHT_CONSECUTIVE_DECLINE = 15;
const WEIGHT_ATTENDANCE_CONCERN = 20;
const WEIGHT_REPEATED_CBT_PRACTICE_STRUGGLE = 8;
/// A practice signal only counts as "repeated" at this many attempts —
/// one weak practice attempt is noise, not a pattern.
const MIN_CBT_PRACTICE_ATTEMPTS_FOR_SIGNAL = 2;

const LEVEL_BANDS: { min: number; level: RiskLevel }[] = [
  { min: 55, level: "CRITICAL" },
  { min: 30, level: "HIGH" },
  { min: 12, level: "MODERATE" },
  { min: 0, level: "LOW" },
];

function levelForScore(score: number): RiskLevel {
  return LEVEL_BANDS.find((b) => score >= b.min)!.level;
}

/// Pure — every input is already-computed structured data from this same
/// folder; nothing here touches the database or calls an AI provider.
export function assessStudentRisk(
  trend: StudentPerformanceTrend,
  subjectAnalysis: SubjectPerformanceAnalysis,
  attendance: AttendancePerformanceAnalysis,
  cbtPractice: CbtPracticeSignal,
  thresholds: PerformanceThresholds
): StudentRiskAssessment {
  const current = trend.current;
  const factors: RiskFactor[] = [];

  if (current.overallAverage !== null && current.overallAverage < thresholds.performancePassMark) {
    factors.push({
      key: "below_pass_mark",
      reason: `Current overall average (${current.overallAverage}%) is below the school's pass mark (${thresholds.performancePassMark}%).`,
      points: WEIGHT_BELOW_PASS_MARK,
    });
  }

  if (current.subjectsFailed >= thresholds.performanceFailedSubjectConcernThreshold) {
    factors.push({
      key: "failed_subjects",
      reason: `The student failed ${current.subjectsFailed} subject${current.subjectsFailed === 1 ? "" : "s"} this term.`,
      points: Math.min(current.subjectsFailed * WEIGHT_PER_FAILED_SUBJECT, WEIGHT_FAILED_SUBJECTS_CAP),
    });
  }

  if (trend.status === "DECLINING" && trend.changePoints !== null) {
    factors.push({
      key: "significant_decline",
      reason: `Overall performance declined by ${Math.abs(trend.changePoints)} percentage points compared to the previous term.`,
      points: WEIGHT_SIGNIFICANT_DECLINE,
    });
  }

  if (trend.isConsecutiveDecline) {
    factors.push({
      key: "consecutive_decline",
      reason: "Performance has declined for at least two consecutive terms.",
      points: WEIGHT_CONSECUTIVE_DECLINE,
    });
  }

  if (attendance.availability === "AVAILABLE" && attendance.isConcern && attendance.attendanceRate !== null) {
    factors.push({
      key: "attendance_concern",
      reason: `Attendance (${attendance.attendanceRate}%) is below the school's configured threshold (${thresholds.attendanceConcernThreshold}%).`,
      points: WEIGHT_ATTENDANCE_CONCERN,
    });
  }

  if (
    cbtPractice.availability === "AVAILABLE" &&
    cbtPractice.attemptCount >= MIN_CBT_PRACTICE_ATTEMPTS_FOR_SIGNAL &&
    cbtPractice.averagePercentage !== null &&
    cbtPractice.averagePercentage < thresholds.performancePassMark
  ) {
    factors.push({
      key: "repeated_cbt_practice_struggle",
      reason: `Practice CBT attempts show repeated low performance (average ${cbtPractice.averagePercentage}% across ${cbtPractice.attemptCount} attempts).`,
      points: WEIGHT_REPEATED_CBT_PRACTICE_STRUGGLE,
    });
  }

  const riskScore = factors.reduce((sum, f) => sum + f.points, 0);

  return {
    riskLevel: levelForScore(riskScore),
    riskScore,
    reasons: factors.map((f) => f.reason),
    factors,
    supportingMetrics: {
      currentAverage: current.overallAverage,
      previousAverage: trend.previous?.overallAverage ?? null,
      changePoints: trend.changePoints,
      attendanceRate: attendance.availability === "AVAILABLE" ? attendance.attendanceRate : null,
      subjectsFailed: current.subjectsFailed,
      isConsecutiveDecline: trend.isConsecutiveDecline,
    },
    analyzedAt: new Date().toISOString(),
  };
}

/// A high bar deliberately fixed (not one of the school's configurable
/// thresholds — the brief only asked for pass-mark/decline/attendance/
/// failed-subject to be configurable) for "excellent, not just passing."
const HIGH_PERFORMANCE_BAR = 75;

/// Positive signals, computed alongside risk but never folded into
/// riskLevel — the brief is explicit that this system should recognize
/// improvement and excellence, not just danger.
export function computeStudentSuccessSignals(
  trend: StudentPerformanceTrend,
  subjectAnalysis: SubjectPerformanceAnalysis,
  attendance: AttendancePerformanceAnalysis,
  thresholds: PerformanceThresholds
): StudentSuccessSignals {
  const consistentHighPerformance =
    trend.current.overallAverage !== null &&
    trend.current.overallAverage >= HIGH_PERFORMANCE_BAR &&
    trend.current.subjectsFailed === 0 &&
    (trend.status === "STABLE" || trend.status === "IMPROVING");

  const improvedAttendance =
    attendance.availability === "AVAILABLE" &&
    attendance.changePoints !== null &&
    attendance.changePoints >= thresholds.performanceSignificantChangePoints;

  const strongSubjectGrowth =
    subjectAnalysis.mostImprovedSubject && subjectAnalysis.mostImprovedSubject.changePoints !== null
      ? subjectAnalysis.mostImprovedSubject
      : null;

  return {
    significantImprovement: trend.status === "IMPROVING",
    consistentHighPerformance,
    improvedAttendance,
    strongSubjectGrowth,
  };
}
