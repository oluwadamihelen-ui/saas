/// Shared shapes for the School Health Dashboard
/// (src/lib/services/school-health/*) — Schoolum's executive-level
/// aggregation layer, distinct from the operational /dashboard. Every
/// number here is either read directly from a deterministic service
/// (Student Performance Analysis, finance-dashboard.ts) or computed by a
/// pure function in this folder. Nothing here is AI-generated; AI (Phase
/// 13) only ever summarizes the already-computed output of this file's
/// types.

/// AVAILABLE: real data exists and was used.
/// UNAVAILABLE: the underlying module/feature doesn't exist in Schoolum
///   at all (e.g. Staff Attendance) — never shown as poor performance.
/// INSUFFICIENT_DATA: the module exists but this school/period has
///   nothing to compute from yet (e.g. no scores entered this term).
/// NOT_APPLICABLE: an optional module exists but this school has never
///   used it (e.g. Online Learning) — informational only, never part of
///   the Health Score.
export type HealthAvailability = "AVAILABLE" | "UNAVAILABLE" | "INSUFFICIENT_DATA" | "NOT_APPLICABLE";

export type HealthLevel = "EXCELLENT" | "GOOD" | "NEEDS_ATTENTION" | "CRITICAL";

export type HealthTrendStatus = "IMPROVING" | "STABLE" | "DECLINING" | "INSUFFICIENT_DATA";

export interface PeriodContext {
  academicSessionId: string;
  academicSessionName: string;
  termId: string;
  termName: string;
}

// ---------------------------------------------------------------------
// Component metrics
// ---------------------------------------------------------------------

export interface AcademicHealthMetrics {
  availability: HealthAvailability;
  /// The component's own 0-100 score — the school-wide average
  /// percentage, taken directly from getSchoolPerformanceOverview(),
  /// never recomputed here.
  score: number | null;
  averageOverall: number | null;
  previousAverage: number | null;
  changePoints: number | null;
  trend: HealthTrendStatus;
  studentsAnalyzed: number;
  studentsRequiringAttention: number; // HIGH + CRITICAL risk
  studentsImproving: number;
  primaryConcern: { classArmId: string; label: string; averageOverall: number } | null;
}

export interface AttendanceHealthMetrics {
  availability: HealthAvailability;
  score: number | null;
  attendanceRate: number | null;
  previousAttendanceRate: number | null;
  changePoints: number | null;
  trend: HealthTrendStatus;
  studentsWithConcern: number;
  lowestAttendanceClass: { classArmId: string; className: string; rate: number } | null;
}

export interface FinancialHealthMetrics {
  availability: HealthAvailability;
  score: number | null;
  expectedMinor: number;
  collectedMinor: number;
  outstandingMinor: number;
  collectionRatePercent: number | null;
  overdueInvoiceCount: number;
  approvedExpensesMinor: number;
  pendingExpenseApprovals: number;
  pendingPaymentApprovals: number;
  paymentTrend: { label: string; amountMinor: number }[];
}

export interface ResultCompletionSummary {
  availability: HealthAvailability;
  studentsApproved: number;
  studentsTotal: number;
  ratePercent: number | null;
}

export interface AttendanceCompletionSummary {
  availability: HealthAvailability;
  classesCompleted: number;
  classesTotal: number;
  ratePercent: number | null;
}

export interface OperationalHealthMetrics {
  availability: HealthAvailability;
  score: number | null;
  attendanceCompletionToday: AttendanceCompletionSummary;
  resultCompletion: ResultCompletionSummary;
  pendingExpenseApprovals: number;
  pendingPaymentApprovals: number;
  admissions: {
    availability: HealthAvailability; // NOT_APPLICABLE when the school has never used the Applicant pipeline
    pending: number;
  };
  onlineLearning: {
    availability: HealthAvailability; // NOT_APPLICABLE when never used
    liveClassesToday: number;
    liveClassesUpcoming: number;
  };
}

// ---------------------------------------------------------------------
// School Health Score
// ---------------------------------------------------------------------

export interface HealthScoreComponent {
  key: "academic" | "attendance" | "financial" | "operational";
  label: string;
  availability: HealthAvailability;
  score: number | null;
  level: HealthLevel | null;
  configuredWeight: number;
  /// Null when the component isn't AVAILABLE (excluded from the score
  /// entirely, not weighted at zero).
  normalizedWeight: number | null;
}

/// FULL: all 4 components available.
/// MOSTLY_COMPLETE: 3 available — a score is still shown, annotated with
///   which component is missing.
/// PARTIAL: 2 available — shown, but labeled "Partial School Health
///   Score" rather than presented as a complete picture.
/// SINGLE_COMPONENT: only 1 available — no overall score is computed at
///   all; only that one component is shown.
/// NO_DATA: 0 available.
export type HealthCompleteness = "FULL" | "MOSTLY_COMPLETE" | "PARTIAL" | "SINGLE_COMPONENT" | "NO_DATA";

export interface SchoolHealthScore {
  overallScore: number | null;
  overallLevel: HealthLevel | null;
  completeness: HealthCompleteness;
  components: HealthScoreComponent[];
}

// ---------------------------------------------------------------------
// Action Center
// ---------------------------------------------------------------------

export type ActionPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "INFORMATIONAL";

export interface ActionItem {
  priority: ActionPriority;
  category: "academic" | "attendance" | "financial" | "operational";
  title: string;
  description: string;
  metric: string;
  href: string;
}

// ---------------------------------------------------------------------
// Staff / enrollment
// ---------------------------------------------------------------------

export interface StaffOverview {
  totalActiveStaff: number;
  suspendedStaff: number;
  newStaffThisMonth: number;
}

export interface EnrollmentSummary {
  currentActiveStudents: number;
  newStudentsThisSession: number;
  studentsLeftThisSession: number;
  growthAvailability: HealthAvailability;
  growthPercent: number | null;
  previousSessionActiveCount: number | null;
}

// ---------------------------------------------------------------------
// Top-level dashboard payload
// ---------------------------------------------------------------------

export interface SchoolHealthDashboard {
  period: PeriodContext | null;
  generatedAt: string;
  healthScore: SchoolHealthScore;
  academic: AcademicHealthMetrics;
  attendance: AttendanceHealthMetrics;
  financial: FinancialHealthMetrics;
  operational: OperationalHealthMetrics;
  staff: StaffOverview;
  enrollment: EnrollmentSummary;
  actionItems: ActionItem[];
  staffAttendanceAvailability: "UNAVAILABLE"; // always — the module doesn't exist; kept explicit rather than silently omitted
}

export interface HealthScoreWeights {
  healthScoreWeightAcademic: number;
  healthScoreWeightAttendance: number;
  healthScoreWeightFinancial: number;
  healthScoreWeightOperational: number;
}
