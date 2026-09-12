/// Shared shapes for the Student Performance Analysis engine
/// (src/lib/services/performance/*). Every function in this folder is
/// deterministic — no AI call anywhere below this file. AI (Phase 11) only
/// ever receives the already-computed output of these types; it never
/// produces them.

/// A term the deterministic engine actually has (or doesn't have) data
/// for — the atomic "academic period" the brief's trend/comparison
/// language refers to.
export interface PerformancePeriod {
  termId: string;
  termName: string;
  academicSessionId: string;
  academicSessionName: string;
  startDate: Date;
}

export type DataAvailability = "AVAILABLE" | "INSUFFICIENT_DATA";

export interface SubjectPerformanceRow {
  subjectId: string;
  subjectName: string;
  /// 0-100, this subject's total scaled against the school's own max
  /// total for the period (sum of AssessmentComponent.maxScore) — never
  /// a raw total, so it's comparable across schools with different
  /// component configurations.
  percentage: number;
  isPassing: boolean;
}

export interface StudentPerformanceMetrics {
  studentId: string;
  period: PerformancePeriod;
  /// The class this period's scores were actually recorded against —
  /// resolved the same way computeReportCard does (dominant
  /// Score.classArmId for this student+term), never Student.classArmId.
  /// Null when no score for this period carries a verified class.
  classArmId: string | null;
  subjects: SubjectPerformanceRow[];
  /// Mean of subjects[].percentage. Null when subjects is empty — never
  /// coerced to 0, which would misrepresent "no data" as "scored zero."
  overallAverage: number | null;
  subjectsPassed: number;
  subjectsFailed: number;
}

export type TrendStatus = "IMPROVING" | "STABLE" | "DECLINING" | "INSUFFICIENT_DATA";

export interface StudentPerformanceTrend {
  status: TrendStatus;
  current: StudentPerformanceMetrics;
  /// Null only when status is INSUFFICIENT_DATA.
  previous: StudentPerformanceMetrics | null;
  /// current.overallAverage - previous.overallAverage, rounded. Null when
  /// either side is unavailable.
  changePoints: number | null;
  /// True only when at least 3 chronologically comparable periods exist
  /// and each is a decline relative to the one before it — see
  /// trend.ts's MIN_PERIODS_FOR_CONSISTENT_DECLINE.
  isConsecutiveDecline: boolean;
}

export type SubjectTrendStatus = "IMPROVING" | "STABLE" | "NEEDS_ATTENTION" | "INSUFFICIENT_DATA";

export interface SubjectTrendRow {
  subjectId: string;
  subjectName: string;
  current: number;
  previous: number | null;
  changePoints: number | null;
  status: SubjectTrendStatus;
}

export interface SubjectPerformanceAnalysis {
  availability: DataAvailability;
  subjects: SubjectTrendRow[];
  /// Requires scores in >= 2 subjects this period — otherwise null with
  /// availability left AVAILABLE if there's exactly one subject (a real,
  /// if limited, result) but strongest/weakest specifically withheld.
  strongestSubject: SubjectTrendRow | null;
  weakestSubject: SubjectTrendRow | null;
  /// Requires a previous-period value on at least one subject.
  mostImprovedSubject: SubjectTrendRow | null;
  mostDeclinedSubject: SubjectTrendRow | null;
}

export interface AttendancePerformanceAnalysis {
  availability: DataAvailability;
  /// Null when availability is INSUFFICIENT_DATA — no attendance rows at
  /// all for this term. Never defaulted to 100 or 0.
  attendanceRate: number | null;
  daysPresent: number;
  daysAbsent: number;
  daysLate: number;
  totalRecorded: number;
  previousAttendanceRate: number | null;
  changePoints: number | null;
  isConcern: boolean;
}

/// Supplementary, deliberately separate from academic averages — see
/// cbt-signal.ts's module comment on why official CBT results are never
/// re-averaged here (they already became a Score and are already inside
/// StudentPerformanceMetrics).
export interface CbtPracticeSignal {
  availability: DataAvailability;
  attemptCount: number;
  averagePercentage: number | null;
}

export interface AssignmentParticipationSignal {
  availability: DataAvailability;
  totalAssignments: number;
  gradedOrSubmitted: number;
  completionRate: number | null;
}

export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export interface RiskFactor {
  key: string;
  reason: string;
  points: number;
}

export interface StudentRiskAssessment {
  riskLevel: RiskLevel;
  riskScore: number;
  reasons: string[];
  factors: RiskFactor[];
  supportingMetrics: {
    currentAverage: number | null;
    previousAverage: number | null;
    changePoints: number | null;
    attendanceRate: number | null;
    subjectsFailed: number;
    isConsecutiveDecline: boolean;
  };
  analyzedAt: string;
}

export interface StudentSuccessSignals {
  significantImprovement: boolean;
  consistentHighPerformance: boolean;
  improvedAttendance: boolean;
  strongSubjectGrowth: SubjectTrendRow | null;
}

export interface StudentPerformanceAnalysis {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  classArmId: string | null;
  className: string | null;
  metrics: StudentPerformanceMetrics;
  /// The same periods trend/risk were computed from (current + whatever
  /// prior periods had data, per periods.ts), oldest-first — for the
  /// term-by-term performance chart. Never padded with invented periods:
  /// a student with only one period on record has a one-point history.
  history: StudentPerformanceMetrics[];
  trend: StudentPerformanceTrend;
  subjectAnalysis: SubjectPerformanceAnalysis;
  attendance: AttendancePerformanceAnalysis;
  cbtPractice: CbtPracticeSignal;
  assignments: AssignmentParticipationSignal;
  risk: StudentRiskAssessment;
  success: StudentSuccessSignals;
}

export interface RiskLevelCounts {
  LOW: number;
  MODERATE: number;
  HIGH: number;
  CRITICAL: number;
}

export interface TrendCounts {
  improving: number;
  stable: number;
  declining: number;
  insufficientData: number;
}

/// One class arm's rollup for a given term — the brief's "JSS 2A" card
/// plus the class risk list table beneath it.
export interface ClassPerformanceOverview {
  classArmId: string;
  className: string;
  termId: string;
  termName: string;
  studentCount: number;
  averageOverall: number | null;
  riskCounts: RiskLevelCounts;
  trendCounts: TrendCounts;
  students: StudentPerformanceAnalysis[];
}

/// The school-wide rollup — every class arm the acting user can see,
/// aggregated, plus the cross-class high-risk/most-improved lists.
export interface SchoolPerformanceOverview {
  termId: string;
  termName: string;
  studentsAnalyzed: number;
  averageOverall: number | null;
  averageAttendance: number | null;
  riskCounts: RiskLevelCounts;
  trendCounts: TrendCounts;
  highRiskStudents: StudentPerformanceAnalysis[];
  mostImprovedStudents: StudentPerformanceAnalysis[];
  classes: Omit<ClassPerformanceOverview, "students">[];
  /// Every analyzed student, unfiltered — kept off the dashboard UI (which
  /// only ever renders the two slices above) and used by the CSV export
  /// route, which needs the complete list rather than a top-20 sample.
  allStudents: StudentPerformanceAnalysis[];
}

export interface PerformanceThresholds {
  performancePassMark: number;
  performanceSignificantChangePoints: number;
  attendanceConcernThreshold: number;
  performanceFailedSubjectConcernThreshold: number;
}
