import "server-only";
import { prisma } from "@/lib/db";
import { getCurrentTerm } from "@/lib/services/academics";
import {
  fetchScores,
  fetchMaxTotal,
  fetchAttendanceSummaries,
  fetchCbtPracticeSummaries,
  fetchAssignmentParticipationSummaries,
  groupScoresByStudentTermSubject,
  resolveDominantClassArmByStudentTerm,
  type AttendanceTermSummary,
  type CbtPracticeTermSummary,
  type AssignmentTermSummary,
} from "./fetchers";
import { listOrderedPeriods, findPriorPeriodsWithData, windowAroundPeriod } from "./periods";
import { computeStudentPerformanceMetrics } from "./metrics";
import { computeStudentPerformanceTrend } from "./trend";
import { computeSubjectPerformanceAnalysis } from "./subject-analysis";
import { computeAttendancePerformanceAnalysis } from "./attendance-analysis";
import { computeCbtPracticeSignal, computeAssignmentParticipationSignal } from "./supplementary-signals";
import { assessStudentRisk, computeStudentSuccessSignals } from "./risk-engine";
import { getAccessibleClassArmIds, canAccessClassArm, PerformanceAccessDeniedError, type ClassArmAccess } from "./authorization";
import type {
  PerformanceThresholds,
  PerformancePeriod,
  StudentPerformanceAnalysis,
  StudentPerformanceMetrics,
  ClassPerformanceOverview,
  SchoolPerformanceOverview,
  RiskLevelCounts,
  TrendCounts,
} from "./types";

/// How many prior periods this folder ever looks at for one student —
/// one more than trend.ts's MIN_PERIODS_FOR_CONSISTENT_DECLINE so a
/// consecutive-decline check always has what it needs, without pulling a
/// school's entire multi-year history for every page view.
const PRIOR_PERIODS_TO_CONSIDER = 3;

export async function getPerformanceThresholds(schoolId: string): Promise<PerformanceThresholds> {
  const school = await prisma.school.findFirstOrThrow({
    where: { id: schoolId },
    select: {
      performancePassMark: true,
      performanceSignificantChangePoints: true,
      attendanceConcernThreshold: true,
      performanceFailedSubjectConcernThreshold: true,
    },
  });
  return school;
}

interface StudentIdentity {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  classArmId: string | null;
  className: string | null;
}

/// Builds one student's full StudentPerformanceAnalysis from already-
/// fetched, already-grouped data — the one function both the
/// single-student and bulk (class/school) paths below funnel through, so
/// there is exactly one place the metrics/trend/subject/attendance/risk
/// pipeline is wired together.
function buildStudentAnalysis(
  student: StudentIdentity,
  targetPeriod: PerformancePeriod,
  priorPeriods: PerformancePeriod[],
  scoresByTerm: Map<string, Map<string, { subjectName: string; total: number }>> | undefined,
  dominantClassArmByTerm: Map<string, string | null> | undefined,
  maxTotal: number,
  attendanceByTerm: Map<string, AttendanceTermSummary> | undefined,
  cbtPracticeForTerm: CbtPracticeTermSummary | undefined,
  assignmentsForTerm: AssignmentTermSummary | undefined,
  thresholds: PerformanceThresholds
): StudentPerformanceAnalysis {
  const currentMetrics = computeStudentPerformanceMetrics(
    student.id,
    targetPeriod,
    scoresByTerm?.get(targetPeriod.termId),
    dominantClassArmByTerm?.get(targetPeriod.termId) ?? null,
    maxTotal,
    thresholds.performancePassMark
  );

  const priorMetrics: StudentPerformanceMetrics[] = priorPeriods.map((period) =>
    computeStudentPerformanceMetrics(
      student.id,
      period,
      scoresByTerm?.get(period.termId),
      dominantClassArmByTerm?.get(period.termId) ?? null,
      maxTotal,
      thresholds.performancePassMark
    )
  );

  const trend = computeStudentPerformanceTrend(currentMetrics, priorMetrics, thresholds.performanceSignificantChangePoints);
  const subjectAnalysis = computeSubjectPerformanceAnalysis(currentMetrics, trend.previous, thresholds.performanceSignificantChangePoints);
  const attendance = computeAttendancePerformanceAnalysis(
    attendanceByTerm?.get(targetPeriod.termId),
    priorPeriods[0] ? attendanceByTerm?.get(priorPeriods[0].termId) : undefined,
    thresholds.attendanceConcernThreshold
  );
  const cbtPractice = computeCbtPracticeSignal(cbtPracticeForTerm);
  const assignments = computeAssignmentParticipationSignal(assignmentsForTerm);
  const risk = assessStudentRisk(trend, subjectAnalysis, attendance, cbtPractice, thresholds);
  const success = computeStudentSuccessSignals(trend, subjectAnalysis, attendance, thresholds);

  // priorMetrics is nearest-first (periods.ts convention); reverse to
  // oldest-first and append the current period, for the chart.
  const history = [...priorMetrics].reverse().concat(currentMetrics);

  return {
    studentId: student.id,
    studentName: `${student.firstName} ${student.lastName}`,
    admissionNumber: student.admissionNumber,
    classArmId: currentMetrics.classArmId ?? student.classArmId,
    className: student.className,
    metrics: currentMetrics,
    history,
    trend,
    subjectAnalysis,
    attendance,
    cbtPractice,
    assignments,
    risk,
    success,
  };
}

// ---------------------------------------------------------------------
// Single student — used by the Student Performance Analysis page and the
// AI assistant tool.
// ---------------------------------------------------------------------

export async function getStudentPerformanceAnalysis(
  schoolId: string,
  actingUserId: string,
  perms: Set<string>,
  studentId: string,
  termId?: string
): Promise<StudentPerformanceAnalysis> {
  const student = await prisma.student.findFirst({
    where: { schoolId, id: studentId },
    include: { classArm: { include: { classGroup: true } } },
  });
  if (!student) throw new Error("Student not found.");

  const targetTerm = termId ? await prisma.term.findFirst({ where: { schoolId, id: termId } }) : await getCurrentTerm(schoolId);
  if (!targetTerm) throw new Error("No academic term available for analysis.");

  const orderedPeriods = await listOrderedPeriods(schoolId);
  const targetPeriod = orderedPeriods.find((p) => p.termId === targetTerm.id);
  if (!targetPeriod) throw new Error("Term not found.");

  // Every score this student has ever had, for the window this folder
  // ever looks back over — one query, bounded, never per-period.
  const allRows = await fetchScores({ schoolId, termIds: orderedPeriods.map((p) => p.termId), studentIds: [studentId] });
  const scoresByStudent = groupScoresByStudentTermSubject(allRows);
  const scoresByTerm = scoresByStudent.get(studentId);
  const dominantClassArmByStudent = resolveDominantClassArmByStudentTerm(allRows);
  const dominantClassArmByTerm = dominantClassArmByStudent.get(studentId);

  // Authorization: resolve the class this specific term's analysis is
  // actually about (verified historical class first, current class only
  // as a fallback when no score exists yet for this term) and check it
  // against what the acting user — teacher or admin — can see. Resolved
  // AFTER we know the real class, never trusted from the request.
  const access: ClassArmAccess = await getAccessibleClassArmIds(schoolId, actingUserId, perms);
  const relevantClassArmId = dominantClassArmByTerm?.get(targetTerm.id) ?? student.classArmId ?? null;
  if (!canAccessClassArm(access, relevantClassArmId)) throw new PerformanceAccessDeniedError();

  const maxTotal = await fetchMaxTotal(schoolId);
  const priorPeriods = findPriorPeriodsWithData(
    orderedPeriods,
    targetTerm.id,
    (tid) => Boolean(scoresByTerm?.get(tid)?.size),
    PRIOR_PERIODS_TO_CONSIDER
  );

  const relevantTermIds = [targetPeriod.termId, ...priorPeriods.map((p) => p.termId)];
  const [attendanceByStudent, cbtByStudent, assignmentsByStudent] = await Promise.all([
    fetchAttendanceSummaries({ schoolId, termIds: relevantTermIds, studentIds: [studentId] }),
    fetchCbtPracticeSummaries({ schoolId, termIds: relevantTermIds, studentIds: [studentId] }),
    fetchAssignmentParticipationSummaries({ schoolId, termIds: relevantTermIds, studentIds: [studentId] }),
  ]);

  const thresholds = await getPerformanceThresholds(schoolId);

  return buildStudentAnalysis(
    {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      admissionNumber: student.admissionNumber,
      classArmId: student.classArmId,
      className: student.classArm ? `${student.classArm.classGroup.name} ${student.classArm.name}` : null,
    },
    targetPeriod,
    priorPeriods,
    scoresByTerm,
    dominantClassArmByTerm,
    maxTotal,
    attendanceByStudent.get(studentId),
    cbtByStudent.get(studentId)?.get(targetTerm.id),
    assignmentsByStudent.get(studentId)?.get(targetTerm.id),
    thresholds
  );
}

// ---------------------------------------------------------------------
// Bulk (class/school) — one set of queries for however many students are
// in scope, never one query per student (brief Test 12).
// ---------------------------------------------------------------------

interface BulkStudentRow {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  classArmId: string | null;
  className: string | null;
}

async function computeBulkStudentAnalyses(
  schoolId: string,
  students: BulkStudentRow[],
  targetPeriod: PerformancePeriod,
  orderedPeriods: PerformancePeriod[],
  thresholds: PerformanceThresholds
): Promise<StudentPerformanceAnalysis[]> {
  if (students.length === 0) return [];
  const studentIds = students.map((s) => s.id);

  // Scores: the full ordered period list, bounded by MAX_LOOKBACK_PERIODS
  // inside findPriorPeriodsWithData's search below — Score rows are one
  // per student/subject/component/term, not one per day, so fetching the
  // school's whole term history for this class in one query stays cheap.
  const [allScoreRows, maxTotal] = await Promise.all([
    fetchScores({ schoolId, termIds: orderedPeriods.map((p) => p.termId), studentIds }),
    fetchMaxTotal(schoolId),
  ]);
  const scoresByStudent = groupScoresByStudentTermSubject(allScoreRows);
  const dominantClassArmByStudent = resolveDominantClassArmByStudentTerm(allScoreRows);

  // Attendance/CBT/assignments are per-day (or otherwise higher-volume)
  // records — bounded to a fixed recent window rather than full history,
  // per periods.ts's windowAroundPeriod doc comment.
  const recentWindow = windowAroundPeriod(orderedPeriods, targetPeriod.termId, PRIOR_PERIODS_TO_CONSIDER);
  const windowTermIds = recentWindow.map((p) => p.termId);

  const [attendanceByStudent, cbtByStudent, assignmentsByStudent] = await Promise.all([
    fetchAttendanceSummaries({ schoolId, termIds: windowTermIds, studentIds }),
    fetchCbtPracticeSummaries({ schoolId, termIds: windowTermIds, studentIds }),
    fetchAssignmentParticipationSummaries({ schoolId, termIds: windowTermIds, studentIds }),
  ]);

  return students.map((student) => {
    const studentScoresByTerm = scoresByStudent.get(student.id);
    const studentDominantByTerm = dominantClassArmByStudent.get(student.id);
    const priorPeriods = findPriorPeriodsWithData(
      orderedPeriods,
      targetPeriod.termId,
      (tid) => Boolean(studentScoresByTerm?.get(tid)?.size),
      PRIOR_PERIODS_TO_CONSIDER
    );
    return buildStudentAnalysis(
      student,
      targetPeriod,
      priorPeriods,
      studentScoresByTerm,
      studentDominantByTerm,
      maxTotal,
      attendanceByStudent.get(student.id),
      cbtByStudent.get(student.id)?.get(targetPeriod.termId),
      assignmentsByStudent.get(student.id)?.get(targetPeriod.termId),
      thresholds
    );
  });
}

function emptyRiskCounts(): RiskLevelCounts {
  return { LOW: 0, MODERATE: 0, HIGH: 0, CRITICAL: 0 };
}

function emptyTrendCounts(): TrendCounts {
  return { improving: 0, stable: 0, declining: 0, insufficientData: 0 };
}

function tallyAnalyses(analyses: StudentPerformanceAnalysis[]): { riskCounts: RiskLevelCounts; trendCounts: TrendCounts; averageOverall: number | null } {
  const riskCounts = emptyRiskCounts();
  const trendCounts = emptyTrendCounts();
  const averages: number[] = [];

  for (const a of analyses) {
    riskCounts[a.risk.riskLevel]++;
    if (a.trend.status === "IMPROVING") trendCounts.improving++;
    else if (a.trend.status === "STABLE") trendCounts.stable++;
    else if (a.trend.status === "DECLINING") trendCounts.declining++;
    else trendCounts.insufficientData++;
    if (a.metrics.overallAverage !== null) averages.push(a.metrics.overallAverage);
  }

  const averageOverall = averages.length > 0 ? Math.round(averages.reduce((s, v) => s + v, 0) / averages.length) : null;
  return { riskCounts, trendCounts, averageOverall };
}

async function resolveTargetPeriod(schoolId: string, termId: string | undefined, orderedPeriods: PerformancePeriod[]): Promise<PerformancePeriod> {
  const term = termId ? await prisma.term.findFirst({ where: { schoolId, id: termId } }) : await getCurrentTerm(schoolId);
  if (!term) throw new Error("No academic term available for analysis.");
  const period = orderedPeriods.find((p) => p.termId === term.id);
  if (!period) throw new Error("Term not found.");
  return period;
}

export async function getClassPerformanceOverview(
  schoolId: string,
  actingUserId: string,
  perms: Set<string>,
  classArmId: string,
  termId?: string
): Promise<ClassPerformanceOverview> {
  const access = await getAccessibleClassArmIds(schoolId, actingUserId, perms);
  if (!canAccessClassArm(access, classArmId))
    throw new PerformanceAccessDeniedError("You are not authorized to view performance analysis for this class.");

  const classArm = await prisma.classArm.findFirst({ where: { schoolId, id: classArmId }, include: { classGroup: true } });
  if (!classArm) throw new Error("Class not found.");

  const orderedPeriods = await listOrderedPeriods(schoolId);
  const targetPeriod = await resolveTargetPeriod(schoolId, termId, orderedPeriods);
  const thresholds = await getPerformanceThresholds(schoolId);

  const studentRows = await prisma.student.findMany({
    where: { schoolId, classArmId, status: "ACTIVE" },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const className = `${classArm.classGroup.name} ${classArm.name}`;
  const students: BulkStudentRow[] = studentRows.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    admissionNumber: s.admissionNumber,
    classArmId: s.classArmId,
    className,
  }));

  const analyses = await computeBulkStudentAnalyses(schoolId, students, targetPeriod, orderedPeriods, thresholds);
  const { riskCounts, trendCounts, averageOverall } = tallyAnalyses(analyses);

  return {
    classArmId,
    className,
    termId: targetPeriod.termId,
    termName: `${targetPeriod.academicSessionName} — ${targetPeriod.termName}`,
    studentCount: students.length,
    averageOverall,
    riskCounts,
    trendCounts,
    students: analyses,
  };
}

export async function getSchoolPerformanceOverview(
  schoolId: string,
  actingUserId: string,
  perms: Set<string>,
  termId?: string
): Promise<SchoolPerformanceOverview> {
  const access = await getAccessibleClassArmIds(schoolId, actingUserId, perms);
  // School-wide is administrator-only — a teacher-scoped user (even one
  // assigned to several classes) gets the class-level view for each of
  // their own classes, never a cross-school rollup (brief: "Do not allow
  // arbitrary access to all students").
  if (access !== "ALL")
    throw new PerformanceAccessDeniedError("You are not authorized to view the school-wide performance overview.");

  const orderedPeriods = await listOrderedPeriods(schoolId);
  const targetPeriod = await resolveTargetPeriod(schoolId, termId, orderedPeriods);
  const thresholds = await getPerformanceThresholds(schoolId);

  const classArms = await prisma.classArm.findMany({ where: { schoolId }, include: { classGroup: true }, orderBy: [{ classGroup: { order: "asc" } }, { name: "asc" }] });
  const studentRows = await prisma.student.findMany({ where: { schoolId, status: "ACTIVE" }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] });

  const classNameByArmId = new Map(classArms.map((c) => [c.id, `${c.classGroup.name} ${c.name}`]));
  const students: BulkStudentRow[] = studentRows.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    admissionNumber: s.admissionNumber,
    classArmId: s.classArmId,
    className: s.classArmId ? (classNameByArmId.get(s.classArmId) ?? null) : null,
  }));

  const analyses = await computeBulkStudentAnalyses(schoolId, students, targetPeriod, orderedPeriods, thresholds);
  const { riskCounts, trendCounts, averageOverall } = tallyAnalyses(analyses);

  const attendanceValues = analyses.map((a) => a.attendance.attendanceRate).filter((v): v is number => v !== null);
  const averageAttendance = attendanceValues.length > 0 ? Math.round(attendanceValues.reduce((s, v) => s + v, 0) / attendanceValues.length) : null;

  const highRiskStudents = analyses
    .filter((a) => a.risk.riskLevel === "HIGH" || a.risk.riskLevel === "CRITICAL")
    .sort((a, b) => b.risk.riskScore - a.risk.riskScore)
    .slice(0, 20);

  const mostImprovedStudents = analyses
    .filter((a) => a.trend.status === "IMPROVING" && a.trend.changePoints !== null)
    .sort((a, b) => (b.trend.changePoints ?? 0) - (a.trend.changePoints ?? 0))
    .slice(0, 20);

  // Per-class rollups reuse the same analyses (no second bulk fetch) —
  // grouped from the one computeBulkStudentAnalyses call above.
  const analysesByClassArm = new Map<string, StudentPerformanceAnalysis[]>();
  for (const a of analyses) {
    const key = a.classArmId ?? "unassigned";
    if (!analysesByClassArm.has(key)) analysesByClassArm.set(key, []);
    analysesByClassArm.get(key)!.push(a);
  }
  const classes = classArms.map((classArm) => {
    const classAnalyses = analysesByClassArm.get(classArm.id) ?? [];
    const tally = tallyAnalyses(classAnalyses);
    return {
      classArmId: classArm.id,
      className: `${classArm.classGroup.name} ${classArm.name}`,
      termId: targetPeriod.termId,
      termName: `${targetPeriod.academicSessionName} — ${targetPeriod.termName}`,
      studentCount: classAnalyses.length,
      averageOverall: tally.averageOverall,
      riskCounts: tally.riskCounts,
      trendCounts: tally.trendCounts,
    };
  });

  return {
    termId: targetPeriod.termId,
    termName: `${targetPeriod.academicSessionName} — ${targetPeriod.termName}`,
    studentsAnalyzed: analyses.length,
    averageOverall,
    averageAttendance,
    riskCounts,
    trendCounts,
    highRiskStudents,
    mostImprovedStudents,
    classes,
    allStudents: analyses,
  };
}
