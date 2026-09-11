import "server-only";
import { prisma } from "@/lib/db";
import { getCurrentTerm } from "@/lib/services/academics";
import { listOrderedPeriods } from "./periods";
import { getAccessibleClassArmIds, PerformanceAccessDeniedError } from "./authorization";
import { getPerformanceThresholds } from "./analysis";
import type { PerformancePeriod } from "./types";

export interface SubjectTermPoint {
  period: PerformancePeriod;
  average: number | null;
  studentCount: number;
}

export interface ClassGroupSubjectRow {
  classGroupId: string;
  classGroupName: string;
  average: number | null;
  studentCount: number;
}

export interface SubjectPerformanceIntelligence {
  subjectId: string;
  subjectName: string;
  termId: string;
  termName: string;
  /// Whole-school average for this subject, one point per academic
  /// period on record — chronological, oldest first (brief's "Subject
  /// Trend View": Term 1 72%, Term 2 65%, Term 3 51% -> Declining).
  trend: SubjectTermPoint[];
  /// This term's average broken down by class group (brief's "Subject
  /// Performance Intelligence": Mathematics — JSS1 72%, JSS2 61%, JSS3
  /// 49%), each requiring at least one student with a score to appear.
  byClassGroup: ClassGroupSubjectRow[];
  /// Only set when the data actually supports it — a class group whose
  /// average is at least the school's own significant-change threshold
  /// below the overall subject average this term, with at least two
  /// class groups on record to compare against. Never generated from
  /// fewer than that (brief: "Only generate this statement when
  /// supported by actual data").
  concernNote: string | null;
}

/// School-wide, cross-class subject analysis — administrator-only, same
/// as getSchoolPerformanceOverview, since it deliberately spans every
/// class a teacher might not be assigned to.
export async function getSubjectPerformanceIntelligence(
  schoolId: string,
  actingUserId: string,
  perms: Set<string>,
  subjectId: string,
  termId?: string
): Promise<SubjectPerformanceIntelligence> {
  const access = await getAccessibleClassArmIds(schoolId, actingUserId, perms);
  if (access !== "ALL") throw new PerformanceAccessDeniedError();

  const subject = await prisma.subject.findFirst({ where: { schoolId, id: subjectId } });
  if (!subject) throw new Error("Subject not found.");

  const orderedPeriods = await listOrderedPeriods(schoolId);
  const targetTerm = termId ? await prisma.term.findFirst({ where: { schoolId, id: termId } }) : await getCurrentTerm(schoolId);
  if (!targetTerm) throw new Error("No academic term available for analysis.");
  const targetPeriod = orderedPeriods.find((p) => p.termId === targetTerm.id);
  if (!targetPeriod) throw new Error("Term not found.");

  const [components, scores] = await Promise.all([
    prisma.assessmentComponent.findMany({ where: { schoolId }, select: { maxScore: true } }),
    prisma.score.findMany({
      where: { schoolId, subjectId },
      select: { studentId: true, termId: true, value: true, classArmId: true, student: { select: { classArmId: true } } },
    }),
  ]);
  const maxTotal = components.reduce((sum, c) => sum + c.maxScore, 0);

  // Per student per term total (a subject total sums its components).
  const totalsByStudentTerm = new Map<string, Map<string, number>>();
  for (const s of scores) {
    if (!totalsByStudentTerm.has(s.termId)) totalsByStudentTerm.set(s.termId, new Map());
    const byStudent = totalsByStudentTerm.get(s.termId)!;
    byStudent.set(s.studentId, (byStudent.get(s.studentId) ?? 0) + s.value);
  }

  const trend: SubjectTermPoint[] = orderedPeriods
    .map((period) => {
      const byStudent = totalsByStudentTerm.get(period.termId);
      if (!byStudent || byStudent.size === 0 || maxTotal === 0) return { period, average: null, studentCount: 0 };
      const percentages = Array.from(byStudent.values()).map((total) => (total / maxTotal) * 100);
      const average = Math.round(percentages.reduce((s, v) => s + v, 0) / percentages.length);
      return { period, average, studentCount: byStudent.size };
    })
    .filter((point) => point.studentCount > 0);

  // This term's rows, grouped by class group — using each score's own
  // verified classArmId when set, falling back to the student's current
  // class only when no verified history exists (same fallback
  // computeReportCard uses), never assuming the class for a score with
  // none.
  const classArms = await prisma.classArm.findMany({ where: { schoolId }, include: { classGroup: true } });
  const classArmToGroup = new Map(classArms.map((c) => [c.id, { id: c.classGroupId, name: c.classGroup.name, order: c.classGroup.order }]));

  const targetTermScores = scores.filter((s) => s.termId === targetTerm.id);
  const totalsByGroupStudent = new Map<string, Map<string, number>>();
  for (const s of targetTermScores) {
    const armId = s.classArmId ?? s.student.classArmId;
    const group = armId ? classArmToGroup.get(armId) : null;
    if (!group) continue;
    if (!totalsByGroupStudent.has(group.id)) totalsByGroupStudent.set(group.id, new Map());
    const byStudent = totalsByGroupStudent.get(group.id)!;
    byStudent.set(s.studentId, (byStudent.get(s.studentId) ?? 0) + s.value);
  }

  const classGroups = await prisma.classGroup.findMany({ where: { schoolId }, orderBy: { order: "asc" } });
  const byClassGroup: ClassGroupSubjectRow[] = classGroups
    .map((cg) => {
      const byStudent = totalsByGroupStudent.get(cg.id);
      if (!byStudent || byStudent.size === 0 || maxTotal === 0) return { classGroupId: cg.id, classGroupName: cg.name, average: null, studentCount: 0 };
      const percentages = Array.from(byStudent.values()).map((total) => (total / maxTotal) * 100);
      const average = Math.round(percentages.reduce((s, v) => s + v, 0) / percentages.length);
      return { classGroupId: cg.id, classGroupName: cg.name, average, studentCount: byStudent.size };
    })
    .filter((row) => row.studentCount > 0);

  const thresholds = await getPerformanceThresholds(schoolId);
  const concernNote = computeConcernNote(subject.name, byClassGroup, thresholds.performanceSignificantChangePoints);

  return {
    subjectId: subject.id,
    subjectName: subject.name,
    termId: targetTerm.id,
    termName: `${targetPeriod.academicSessionName} — ${targetPeriod.termName}`,
    trend,
    byClassGroup,
    concernNote,
  };
}

function computeConcernNote(subjectName: string, rows: ClassGroupSubjectRow[], significantChangePoints: number): string | null {
  const withData = rows.filter((r) => r.average !== null) as (ClassGroupSubjectRow & { average: number })[];
  if (withData.length < 2) return null;

  const overallAverage = Math.round(withData.reduce((s, r) => s + r.average, 0) / withData.length);
  const lowest = withData.reduce((worst, r) => (r.average < worst.average ? r : worst));
  if (overallAverage - lowest.average >= significantChangePoints) {
    return `${lowest.classGroupName} ${subjectName} performance (${lowest.average}%) is significantly below the school average (${overallAverage}%) for this subject.`;
  }
  return null;
}
