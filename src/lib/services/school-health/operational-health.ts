import "server-only";
import { prisma } from "@/lib/db";
import { getPendingApprovalsCount } from "@/lib/services/finance-dashboard";
import type { OperationalHealthMetrics, PeriodContext } from "./types";

const ADMISSION_PENDING_STATUSES = ["APPLIED", "UNDER_REVIEW", "OFFERED", "ACCEPTED"] as const;
const UPCOMING_LIVE_CLASS_WINDOW_DAYS = 7;

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}
function endOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(23, 59, 59, 999);
  return copy;
}

/// Operational Health is a composite of only the sub-signals that have a
/// natural 0-100 rate (attendance completion, result completion) —
/// pending approvals and admissions have no honest 0-100 scale (there's
/// no natural ceiling to "8 pending approvals"), so they surface as
/// informational metrics and Action Center items instead of being forced
/// into the score itself. See health-score.ts for how the two rates
/// combine into one component score.
export async function getOperationalHealth(schoolId: string, period: PeriodContext): Promise<OperationalHealthMetrics> {
  const today = new Date();

  const [
    classArmsWithStudents,
    todaysAttendanceClassIds,
    activeStudentCount,
    approvedReportCards,
    anyScoreThisTerm,
    pending,
    totalApplicantsEver,
    pendingAdmissions,
    liveClassesToday,
    liveClassesUpcoming,
    anyOnlineLearningEver,
  ] = await Promise.all([
    prisma.classArm.findMany({ where: { schoolId, students: { some: { status: "ACTIVE" } } }, select: { id: true } }),
    prisma.attendanceRecord.findMany({
      where: { schoolId, date: { gte: startOfDay(today), lte: endOfDay(today) } },
      select: { classArmId: true },
      distinct: ["classArmId"],
    }),
    prisma.student.count({ where: { schoolId, status: "ACTIVE" } }),
    prisma.reportCard.count({ where: { schoolId, termId: period.termId, status: { in: ["APPROVED", "PUBLISHED"] } } }),
    prisma.score.findFirst({ where: { schoolId, termId: period.termId }, select: { id: true } }),
    getPendingApprovalsCount(schoolId),
    prisma.applicant.count({ where: { schoolId } }),
    prisma.applicant.count({ where: { schoolId, status: { in: [...ADMISSION_PENDING_STATUSES] } } }),
    prisma.liveClass.count({
      where: { schoolId, status: { in: ["SCHEDULED", "LIVE"] }, scheduledStart: { gte: startOfDay(today), lte: endOfDay(today) } },
    }),
    prisma.liveClass.count({
      where: {
        schoolId,
        status: "SCHEDULED",
        scheduledStart: { gt: endOfDay(today), lte: endOfDay(new Date(today.getTime() + UPCOMING_LIVE_CLASS_WINDOW_DAYS * 86_400_000)) },
      },
    }),
    prisma.liveClass.count({ where: { schoolId } }),
  ]);

  const classesTotal = classArmsWithStudents.length;
  const classesCompleted = todaysAttendanceClassIds.length;
  const attendanceCompletionToday: OperationalHealthMetrics["attendanceCompletionToday"] =
    classesTotal === 0
      ? { availability: "INSUFFICIENT_DATA", classesCompleted: 0, classesTotal: 0, ratePercent: null }
      : { availability: "AVAILABLE", classesCompleted, classesTotal, ratePercent: Math.round((classesCompleted / classesTotal) * 100) };

  const resultCompletion: OperationalHealthMetrics["resultCompletion"] =
    !anyScoreThisTerm || activeStudentCount === 0
      ? { availability: "INSUFFICIENT_DATA", studentsApproved: 0, studentsTotal: activeStudentCount, ratePercent: null }
      : {
          availability: "AVAILABLE",
          studentsApproved: approvedReportCards,
          studentsTotal: activeStudentCount,
          ratePercent: Math.round((approvedReportCards / activeStudentCount) * 100),
        };

  const availableRates = [attendanceCompletionToday, resultCompletion]
    .filter((c) => c.availability === "AVAILABLE" && c.ratePercent !== null)
    .map((c) => c.ratePercent!);
  const score = availableRates.length > 0 ? Math.round(availableRates.reduce((s, v) => s + v, 0) / availableRates.length) : null;

  return {
    availability: score !== null ? "AVAILABLE" : "INSUFFICIENT_DATA",
    score,
    attendanceCompletionToday,
    resultCompletion,
    pendingExpenseApprovals: pending.pendingExpenses,
    pendingPaymentApprovals: pending.pendingPayments,
    admissions: {
      availability: totalApplicantsEver > 0 ? "AVAILABLE" : "NOT_APPLICABLE",
      pending: totalApplicantsEver > 0 ? pendingAdmissions : 0,
    },
    onlineLearning: {
      availability: anyOnlineLearningEver > 0 ? "AVAILABLE" : "NOT_APPLICABLE",
      liveClassesToday,
      liveClassesUpcoming,
    },
  };
}
