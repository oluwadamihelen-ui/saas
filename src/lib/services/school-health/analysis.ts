import "server-only";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { getCurrentTerm } from "@/lib/services/academics";
import { getAcademicHealth } from "./academic-health";
import { getAttendanceHealth } from "./attendance-health";
import { getFinancialHealth } from "./financial-health";
import { getOperationalHealth } from "./operational-health";
import { computeSchoolHealthScore } from "./health-score";
import { buildActionCenter } from "./action-center";
import type {
  AcademicHealthMetrics,
  AttendanceHealthMetrics,
  EnrollmentSummary,
  FinancialHealthMetrics,
  OperationalHealthMetrics,
  PeriodContext,
  SchoolHealthDashboard,
  StaffOverview,
} from "./types";

export class SchoolHealthAccessDeniedError extends Error {
  constructor(message = "The School Health Dashboard requires both academic and financial oversight permissions.") {
    super(message);
    this.name = "SchoolHealthAccessDeniedError";
  }
}

/// The one server-side gate this whole dashboard sits behind — per
/// Decision 1, `academics.manage` AND `finance.view` together, never
/// role names, never trusted from the client. Call this before doing
/// anything else; every other function in this folder assumes it has
/// already passed.
export function assertSchoolHealthAccess(perms: Set<string>): void {
  if (!perms.has(PERMISSIONS.ACADEMICS_MANAGE) || !perms.has(PERMISSIONS.FINANCE_VIEW)) {
    throw new SchoolHealthAccessDeniedError();
  }
}

// A User whose role is PARENT/STUDENT is a portal login, not staff — see
// the audit's §14 finding that getDashboardStats().totalStaff incorrectly
// includes them. Never reused here; this dashboard computes its own,
// correctly-scoped count instead.
const PORTAL_ROLE_KEYS = ["PARENT", "STUDENT"];

async function getStaffOverview(schoolId: string): Promise<StaffOverview> {
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const staffFilter = { schoolId, role: { key: { notIn: PORTAL_ROLE_KEYS } } };
  const [totalActiveStaff, suspendedStaff, newStaffThisMonth] = await Promise.all([
    prisma.user.count({ where: { ...staffFilter, status: "ACTIVE" } }),
    prisma.user.count({ where: { ...staffFilter, status: "SUSPENDED" } }),
    prisma.user.count({ where: { ...staffFilter, createdAt: { gte: startOfMonth } } }),
  ]);

  return { totalActiveStaff, suspendedStaff, newStaffThisMonth };
}

async function getEnrollmentSummary(schoolId: string, sessionId: string, sessionStartDate: Date): Promise<EnrollmentSummary> {
  const [currentActiveStudents, newStudentsThisSession, studentsLeftThisSession, allSessions] = await Promise.all([
    prisma.student.count({ where: { schoolId, status: "ACTIVE" } }),
    prisma.student.count({ where: { schoolId, admissionDate: { gte: sessionStartDate } } }),
    prisma.studentClassHistory.count({
      where: { schoolId, academicSessionId: sessionId, status: "WITHDRAWN", endDate: { not: null } },
    }),
    prisma.academicSession.findMany({ where: { schoolId }, orderBy: { startDate: "asc" }, select: { id: true } }),
  ]);

  const currentIndex = allSessions.findIndex((s) => s.id === sessionId);
  const previousSessionId = currentIndex > 0 ? allSessions[currentIndex - 1].id : null;

  let previousSessionActiveCount: number | null = null;
  if (previousSessionId) {
    // "Active in the previous session" = had at least one StudentClassHistory
    // row for that session — real historical data, never inferred from
    // current status or a missing class assignment (brief: do not infer
    // withdrawals from unrelated signals).
    const rows = await prisma.studentClassHistory.findMany({
      where: { schoolId, academicSessionId: previousSessionId },
      select: { studentId: true },
      distinct: ["studentId"],
    });
    if (rows.length > 0) previousSessionActiveCount = rows.length;
  }

  const growthPercent =
    previousSessionActiveCount !== null && previousSessionActiveCount > 0
      ? Math.round(((currentActiveStudents - previousSessionActiveCount) / previousSessionActiveCount) * 1000) / 10
      : null;

  return {
    currentActiveStudents,
    newStudentsThisSession,
    studentsLeftThisSession,
    growthAvailability: growthPercent !== null ? "AVAILABLE" : "INSUFFICIENT_DATA",
    growthPercent,
    previousSessionActiveCount,
  };
}

function emptyAcademic(): AcademicHealthMetrics {
  return {
    availability: "INSUFFICIENT_DATA",
    score: null,
    averageOverall: null,
    previousAverage: null,
    changePoints: null,
    trend: "INSUFFICIENT_DATA",
    studentsAnalyzed: 0,
    studentsRequiringAttention: 0,
    studentsImproving: 0,
    primaryConcern: null,
  };
}
function emptyAttendance(): AttendanceHealthMetrics {
  return {
    availability: "INSUFFICIENT_DATA",
    score: null,
    attendanceRate: null,
    previousAttendanceRate: null,
    changePoints: null,
    trend: "INSUFFICIENT_DATA",
    studentsWithConcern: 0,
    lowestAttendanceClass: null,
  };
}
function emptyFinancial(): FinancialHealthMetrics {
  return {
    availability: "INSUFFICIENT_DATA",
    score: null,
    expectedMinor: 0,
    collectedMinor: 0,
    outstandingMinor: 0,
    collectionRatePercent: null,
    overdueInvoiceCount: 0,
    approvedExpensesMinor: 0,
    pendingExpenseApprovals: 0,
    pendingPaymentApprovals: 0,
    paymentTrend: [],
  };
}
function emptyOperational(): OperationalHealthMetrics {
  return {
    availability: "INSUFFICIENT_DATA",
    score: null,
    attendanceCompletionToday: { availability: "INSUFFICIENT_DATA", classesCompleted: 0, classesTotal: 0, ratePercent: null },
    resultCompletion: { availability: "INSUFFICIENT_DATA", studentsApproved: 0, studentsTotal: 0, ratePercent: null },
    pendingExpenseApprovals: 0,
    pendingPaymentApprovals: 0,
    admissions: { availability: "NOT_APPLICABLE", pending: 0 },
    onlineLearning: { availability: "NOT_APPLICABLE", liveClassesToday: 0, liveClassesUpcoming: 0 },
  };
}

/// The single secure entry point for the School Health Dashboard.
/// 1. Enforces access (academics.manage AND finance.view).
/// 2. Resolves schoolId-scoped period context only — never trusts a
///    termId across schools (validated below).
/// 3. Fetches every component in parallel, each already scoped and
///    already honest about missing data.
/// 4. Computes the deterministic score and action items from that data —
///    no additional database access happens in either step.
export async function getSchoolHealthDashboard(
  schoolId: string,
  actingUserId: string,
  perms: Set<string>,
  termId?: string
): Promise<SchoolHealthDashboard> {
  assertSchoolHealthAccess(perms);

  const school = await prisma.school.findUniqueOrThrow({
    where: { id: schoolId },
    select: {
      currency: true,
      healthScoreWeightAcademic: true,
      healthScoreWeightAttendance: true,
      healthScoreWeightFinancial: true,
      healthScoreWeightOperational: true,
    },
  });

  const term = termId
    ? await prisma.term.findFirst({ where: { schoolId, id: termId }, include: { academicSession: true } })
    : await getCurrentTerm(schoolId).then((t) => (t ? prisma.term.findFirst({ where: { schoolId, id: t.id }, include: { academicSession: true } }) : null));

  const generatedAt = new Date().toISOString();

  if (!term) {
    const academic = emptyAcademic();
    const attendance = emptyAttendance();
    const financial = emptyFinancial();
    const operational = emptyOperational();
    const healthScore = computeSchoolHealthScore(academic, attendance, financial, operational, school);
    const staff = await getStaffOverview(schoolId);
    return {
      period: null,
      generatedAt,
      healthScore,
      academic,
      attendance,
      financial,
      operational,
      staff,
      enrollment: {
        currentActiveStudents: await prisma.student.count({ where: { schoolId, status: "ACTIVE" } }),
        newStudentsThisSession: 0,
        studentsLeftThisSession: 0,
        growthAvailability: "INSUFFICIENT_DATA",
        growthPercent: null,
        previousSessionActiveCount: null,
      },
      actionItems: [],
      staffAttendanceAvailability: "UNAVAILABLE",
    };
  }

  const period: PeriodContext = {
    academicSessionId: term.academicSessionId,
    academicSessionName: term.academicSession.name,
    termId: term.id,
    termName: term.name,
  };

  const [academic, attendance, financial, operational, staff, enrollment] = await Promise.all([
    getAcademicHealth(schoolId, actingUserId, perms, period),
    getAttendanceHealth(schoolId, period),
    getFinancialHealth(schoolId, period),
    getOperationalHealth(schoolId, period),
    getStaffOverview(schoolId),
    getEnrollmentSummary(schoolId, term.academicSessionId, term.academicSession.startDate),
  ]);

  const healthScore = computeSchoolHealthScore(academic, attendance, financial, operational, school);
  const actionItems = buildActionCenter(healthScore, academic, attendance, financial, operational, period, school.currency);

  return {
    period,
    generatedAt,
    healthScore,
    academic,
    attendance,
    financial,
    operational,
    staff,
    enrollment,
    actionItems,
    staffAttendanceAvailability: "UNAVAILABLE",
  };
}
