import type {
  AcademicHealthMetrics,
  ActionItem,
  ActionPriority,
  AttendanceHealthMetrics,
  FinancialHealthMetrics,
  OperationalHealthMetrics,
  PeriodContext,
  SchoolHealthScore,
} from "./types";
import { formatMoney } from "@/lib/money";

const PRIORITY_ORDER: Record<ActionPriority, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, INFORMATIONAL: 3 };

/// Pure — every item below is derived only from already-computed,
/// already-honest metrics (no new calculation happens here). No item is
/// invented to keep the list "busy": a school with nothing notable
/// returns an empty array, and the page shows a positive empty state.
///
/// CRITICAL is reserved for the overall Health Score itself reading
/// CRITICAL — never for a single component metric alone, per the brief's
/// explicit "a student having one low score should not automatically
/// create a critical school-wide alert."
export function buildActionCenter(
  healthScore: SchoolHealthScore,
  academic: AcademicHealthMetrics,
  attendance: AttendanceHealthMetrics,
  financial: FinancialHealthMetrics,
  operational: OperationalHealthMetrics,
  period: PeriodContext,
  currency: string
): ActionItem[] {
  const items: ActionItem[] = [];
  const termQuery = `?termId=${period.termId}`;
  const today = new Date().toISOString().slice(0, 10);

  if (healthScore.completeness !== "NO_DATA" && healthScore.completeness !== "SINGLE_COMPONENT" && healthScore.overallLevel === "CRITICAL") {
    items.push({
      priority: "CRITICAL",
      category: "operational",
      title: "Overall school health is Critical",
      description: "Multiple areas need attention at the same time — review each health component below.",
      metric: `${healthScore.overallScore}/100`,
      href: "/dashboard/school-health",
    });
  }

  if (academic.availability === "AVAILABLE" && academic.studentsRequiringAttention > 0) {
    items.push({
      priority: "HIGH",
      category: "academic",
      title: `${academic.studentsRequiringAttention} Student${academic.studentsRequiringAttention === 1 ? "" : "s"} Require Academic Support`,
      description: "Identified as HIGH or CRITICAL academic risk this term.",
      metric: String(academic.studentsRequiringAttention),
      href: `/dashboard/performance${termQuery}`,
    });
  }

  if (academic.availability === "AVAILABLE" && academic.primaryConcern) {
    items.push({
      priority: "MEDIUM",
      category: "academic",
      title: `${academic.primaryConcern.label} Is the Lowest-Performing Class`,
      description: "Averaging below the rest of the school this term.",
      metric: `${academic.primaryConcern.averageOverall}%`,
      href: `/dashboard/performance/class/${academic.primaryConcern.classArmId}${termQuery}`,
    });
  }

  if (attendance.availability === "AVAILABLE" && attendance.lowestAttendanceClass) {
    items.push({
      priority: "MEDIUM",
      category: "attendance",
      title: `${attendance.lowestAttendanceClass.className} Has the Lowest Attendance`,
      description: "Attendance rate for this term is below the rest of the school.",
      metric: `${attendance.lowestAttendanceClass.rate}%`,
      href: `/dashboard/attendance?classArmId=${attendance.lowestAttendanceClass.classArmId}&date=${today}`,
    });
  }

  if (attendance.availability === "AVAILABLE" && attendance.studentsWithConcern > 0) {
    items.push({
      priority: "MEDIUM",
      category: "attendance",
      title: `${attendance.studentsWithConcern} Student${attendance.studentsWithConcern === 1 ? "" : "s"} Have Attendance Concerns`,
      description: "Below the school's configured attendance threshold this term.",
      metric: String(attendance.studentsWithConcern),
      href: `/dashboard/performance${termQuery}`,
    });
  }

  if (operational.attendanceCompletionToday.availability === "AVAILABLE" && operational.attendanceCompletionToday.ratePercent !== null && operational.attendanceCompletionToday.ratePercent < 100) {
    const pendingClasses = operational.attendanceCompletionToday.classesTotal - operational.attendanceCompletionToday.classesCompleted;
    items.push({
      priority: "MEDIUM",
      category: "operational",
      title: `${pendingClasses} Class${pendingClasses === 1 ? "" : "es"} Have Not Recorded Attendance Today`,
      description: "Today's attendance is still incomplete for these classes.",
      metric: `${operational.attendanceCompletionToday.classesCompleted}/${operational.attendanceCompletionToday.classesTotal}`,
      href: `/dashboard/attendance?date=${today}`,
    });
  }

  if (financial.availability === "AVAILABLE" && financial.outstandingMinor > 0) {
    items.push({
      priority: "MEDIUM",
      category: "financial",
      title: "Outstanding Fees Require Follow-Up",
      description: financial.collectionRatePercent !== null ? `${100 - financial.collectionRatePercent}% of expected fees remain unpaid.` : "Fees remain unpaid this term.",
      metric: formatMoney(financial.outstandingMinor, currency),
      href: "/dashboard/finance",
    });
  }

  const pendingApprovals = (financial.pendingExpenseApprovals ?? 0) + (financial.pendingPaymentApprovals ?? 0);
  if (financial.availability === "AVAILABLE" && pendingApprovals > 0) {
    items.push({
      priority: "MEDIUM",
      category: "financial",
      title: `${pendingApprovals} Financial Approval${pendingApprovals === 1 ? "" : "s"} Pending`,
      description: "Expense or payment records awaiting review.",
      metric: String(pendingApprovals),
      href: "/dashboard/finance",
    });
  }

  if (operational.admissions.availability === "AVAILABLE" && operational.admissions.pending > 0) {
    items.push({
      priority: "INFORMATIONAL",
      category: "operational",
      title: `${operational.admissions.pending} Admission Application${operational.admissions.pending === 1 ? "" : "s"} Pending`,
      description: "Applicants awaiting a decision.",
      metric: String(operational.admissions.pending),
      href: "/dashboard/administration/admission",
    });
  }

  if (operational.resultCompletion.availability === "AVAILABLE" && operational.resultCompletion.ratePercent !== null && operational.resultCompletion.ratePercent < 100) {
    items.push({
      priority: "INFORMATIONAL",
      category: "academic",
      title: "Report Cards Still Being Approved",
      description: "Students whose report card for this term has not yet been approved.",
      metric: `${operational.resultCompletion.studentsApproved}/${operational.resultCompletion.studentsTotal}`,
      href: `/dashboard/results/report-cards`,
    });
  }

  if (operational.onlineLearning.availability === "AVAILABLE" && operational.onlineLearning.liveClassesToday > 0) {
    items.push({
      priority: "INFORMATIONAL",
      category: "operational",
      title: `${operational.onlineLearning.liveClassesToday} Live Class${operational.onlineLearning.liveClassesToday === 1 ? "" : "es"} Scheduled Today`,
      description: "Scheduled live online classes for today.",
      metric: String(operational.onlineLearning.liveClassesToday),
      href: "/dashboard/online-learning/admin/live-classes",
    });
  }

  return items.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}
