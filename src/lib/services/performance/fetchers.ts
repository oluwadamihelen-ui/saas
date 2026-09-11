import "server-only";
import { prisma } from "@/lib/db";
import { resolveDominantClassArmId } from "@/lib/services/results";

/// Bulk, read-only data access for the performance-analysis engine.
/// Everything here is scoped to a set of termIds and (optionally) a set
/// of studentIds/one classArmId, fetched in ONE query per data type
/// regardless of how many students or terms are involved — never one
/// query per student (brief Test 12: 100+ students, no N+1). Callers
/// group the flat rows into per-student maps themselves; these functions
/// never call computeReportCard (which upserts a ReportCard row as a
/// side effect — fine for the one-student, one-term Results page it was
/// built for, wrong for a read-only dashboard that may touch hundreds of
/// student-term combinations on a single page load).

export interface ScoreFetchScope {
  schoolId: string;
  termIds: string[];
  studentIds?: string[];
  classArmId?: string;
}

export interface RawScoreRow {
  studentId: string;
  subjectId: string;
  subjectName: string;
  termId: string;
  value: number;
  classArmId: string | null;
}

export async function fetchScores(scope: ScoreFetchScope): Promise<RawScoreRow[]> {
  if (scope.termIds.length === 0) return [];
  const rows = await prisma.score.findMany({
    where: {
      schoolId: scope.schoolId,
      termId: { in: scope.termIds },
      ...(scope.studentIds ? { studentId: { in: scope.studentIds } } : {}),
      ...(scope.classArmId ? { student: { classArmId: scope.classArmId } } : {}),
    },
    select: { studentId: true, subjectId: true, termId: true, value: true, classArmId: true, subject: { select: { name: true } } },
  });
  return rows.map((r) => ({
    studentId: r.studentId,
    subjectId: r.subjectId,
    subjectName: r.subject.name,
    termId: r.termId,
    value: r.value,
    classArmId: r.classArmId,
  }));
}

/// Sum of every assessment-component's max score — the denominator every
/// subject total is scaled against to become a 0-100 percentage. One
/// query, reused across every student/term the caller processes.
export async function fetchMaxTotal(schoolId: string): Promise<number> {
  const components = await prisma.assessmentComponent.findMany({ where: { schoolId }, select: { maxScore: true } });
  return components.reduce((sum, c) => sum + c.maxScore, 0);
}

/// Groups raw score rows into studentId -> termId -> subjectId -> total,
/// summing multiple components (e.g. "1st CA" + "2nd CA" + "Exam") into
/// one subject total per student per term — the same aggregation
/// computeReportCard does, just without its ReportCard side effect.
export function groupScoresByStudentTermSubject(
  rows: RawScoreRow[]
): Map<string, Map<string, Map<string, { subjectName: string; total: number }>>> {
  const byStudent = new Map<string, Map<string, Map<string, { subjectName: string; total: number }>>>();
  for (const row of rows) {
    if (!byStudent.has(row.studentId)) byStudent.set(row.studentId, new Map());
    const byTerm = byStudent.get(row.studentId)!;
    if (!byTerm.has(row.termId)) byTerm.set(row.termId, new Map());
    const bySubject = byTerm.get(row.termId)!;
    const existing = bySubject.get(row.subjectId);
    if (existing) existing.total += row.value;
    else bySubject.set(row.subjectId, { subjectName: row.subjectName, total: row.value });
  }
  return byStudent;
}

/// studentId -> termId -> dominant classArmId, using the exact same
/// "most of this student's own scores for the term agree on" resolution
/// computeReportCard uses (see results.ts's resolveDominantClassArmId) —
/// never Student.classArmId, so a promoted student's past terms keep
/// their real historical class (brief Test 8).
export function resolveDominantClassArmByStudentTerm(rows: RawScoreRow[]): Map<string, Map<string, string | null>> {
  const byStudent = new Map<string, Map<string, RawScoreRow[]>>();
  for (const row of rows) {
    if (!byStudent.has(row.studentId)) byStudent.set(row.studentId, new Map());
    const byTerm = byStudent.get(row.studentId)!;
    if (!byTerm.has(row.termId)) byTerm.set(row.termId, []);
    byTerm.get(row.termId)!.push(row);
  }
  const result = new Map<string, Map<string, string | null>>();
  for (const [studentId, byTerm] of byStudent) {
    const termMap = new Map<string, string | null>();
    for (const [termId, termRows] of byTerm) {
      termMap.set(termId, resolveDominantClassArmId(termRows));
    }
    result.set(studentId, termMap);
  }
  return result;
}

export interface AttendanceTermSummary {
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
}

/// studentId -> termId -> attendance summary, one query for however many
/// students/terms are in scope. AttendanceRecord.termId makes this
/// term-scoped, unlike the existing getStudentAttendanceHistory (last N
/// records regardless of term) — additive, doesn't touch that helper.
export async function fetchAttendanceSummaries(scope: {
  schoolId: string;
  termIds: string[];
  studentIds?: string[];
  classArmId?: string;
}): Promise<Map<string, Map<string, AttendanceTermSummary>>> {
  const result = new Map<string, Map<string, AttendanceTermSummary>>();
  if (scope.termIds.length === 0) return result;

  const rows = await prisma.attendanceRecord.findMany({
    where: {
      schoolId: scope.schoolId,
      termId: { in: scope.termIds },
      ...(scope.studentIds ? { studentId: { in: scope.studentIds } } : {}),
      ...(scope.classArmId ? { classArmId: scope.classArmId } : {}),
    },
    select: { studentId: true, termId: true, status: true },
  });

  for (const row of rows) {
    if (!result.has(row.studentId)) result.set(row.studentId, new Map());
    const byTerm = result.get(row.studentId)!;
    if (!byTerm.has(row.termId)) byTerm.set(row.termId, { present: 0, absent: 0, late: 0, excused: 0, total: 0 });
    const summary = byTerm.get(row.termId)!;
    summary.total += 1;
    if (row.status === "PRESENT") summary.present += 1;
    else if (row.status === "ABSENT") summary.absent += 1;
    else if (row.status === "LATE") summary.late += 1;
    else if (row.status === "EXCUSED") summary.excused += 1;
  }
  return result;
}

export interface CbtPracticeTermSummary {
  count: number;
  totalPercentage: number;
}

/// studentId -> termId -> practice/non-official CBT summary. Deliberately
/// excludes isOfficialResult: true attempts — those already wrote a
/// Score row (see schema.prisma's CBT module comment) and are already
/// inside fetchScores' academic totals; including them here too would
/// double-count the same result under two different labels.
export async function fetchCbtPracticeSummaries(scope: {
  schoolId: string;
  termIds: string[];
  studentIds?: string[];
}): Promise<Map<string, Map<string, CbtPracticeTermSummary>>> {
  const result = new Map<string, Map<string, CbtPracticeTermSummary>>();
  if (scope.termIds.length === 0) return result;

  const rows = await prisma.cBTAttempt.findMany({
    where: {
      schoolId: scope.schoolId,
      isOfficialResult: false,
      percentage: { not: null },
      status: { in: ["SUBMITTED", "AUTO_SUBMITTED", "GRADED"] },
      exam: { termId: { in: scope.termIds } },
      ...(scope.studentIds ? { studentId: { in: scope.studentIds } } : {}),
    },
    select: { studentId: true, percentage: true, exam: { select: { termId: true } } },
  });

  for (const row of rows) {
    const termId = row.exam.termId;
    if (!result.has(row.studentId)) result.set(row.studentId, new Map());
    const byTerm = result.get(row.studentId)!;
    if (!byTerm.has(termId)) byTerm.set(termId, { count: 0, totalPercentage: 0 });
    const summary = byTerm.get(termId)!;
    summary.count += 1;
    summary.totalPercentage += row.percentage ?? 0;
  }
  return result;
}

export interface AssignmentTermSummary {
  total: number;
  gradedOrSubmitted: number;
}

/// studentId -> termId -> assignment completion summary. Deliberately
/// counts completion, never averages AssignmentSubmission.score — scores
/// aren't normalized to a common maximum across assignments, so a
/// percentage built from them would compare incompatible scales (brief:
/// "do not create misleading percentage comparisons").
export async function fetchAssignmentParticipationSummaries(scope: {
  schoolId: string;
  termIds: string[];
  studentIds?: string[];
  classArmId?: string;
}): Promise<Map<string, Map<string, AssignmentTermSummary>>> {
  const result = new Map<string, Map<string, AssignmentTermSummary>>();
  if (scope.termIds.length === 0) return result;

  const submissions = await prisma.assignmentSubmission.findMany({
    where: {
      assignment: {
        schoolId: scope.schoolId,
        termId: { in: scope.termIds },
        ...(scope.classArmId ? { classArmId: scope.classArmId } : {}),
      },
      ...(scope.studentIds ? { studentId: { in: scope.studentIds } } : {}),
    },
    select: { studentId: true, status: true, assignment: { select: { termId: true } } },
  });

  for (const row of submissions) {
    const termId = row.assignment.termId;
    if (!result.has(row.studentId)) result.set(row.studentId, new Map());
    const byTerm = result.get(row.studentId)!;
    if (!byTerm.has(termId)) byTerm.set(termId, { total: 0, gradedOrSubmitted: 0 });
    const summary = byTerm.get(termId)!;
    summary.total += 1;
    if (row.status === "SUBMITTED" || row.status === "GRADED") summary.gradedOrSubmitted += 1;
  }
  return result;
}
