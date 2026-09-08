import "server-only";
import { prisma } from "@/lib/db";
import { notifyReportCardPublished } from "@/lib/services/notifications";

// ---------------------------------------------------------------------------
// Grading configuration (per-school, editable)
// ---------------------------------------------------------------------------

export async function listGradeBands(schoolId: string) {
  return prisma.gradeBand.findMany({ where: { schoolId }, orderBy: { order: "asc" } });
}

export async function createGradeBand(
  schoolId: string,
  input: { grade: string; minScore: number; maxScore: number; remark: string }
) {
  const count = await prisma.gradeBand.count({ where: { schoolId } });
  return prisma.gradeBand.create({ data: { schoolId, ...input, order: count } });
}

export async function deleteGradeBand(schoolId: string, id: string) {
  const existing = await prisma.gradeBand.findFirst({ where: { schoolId, id } });
  if (!existing) throw new Error("Grade band not found");
  await prisma.gradeBand.delete({ where: { id } });
}

export async function listAssessmentComponents(schoolId: string) {
  return prisma.assessmentComponent.findMany({ where: { schoolId }, orderBy: { order: "asc" } });
}

export async function createAssessmentComponent(schoolId: string, input: { name: string; maxScore: number }) {
  const count = await prisma.assessmentComponent.count({ where: { schoolId } });
  return prisma.assessmentComponent.create({ data: { schoolId, ...input, order: count } });
}

export async function deleteAssessmentComponent(schoolId: string, id: string) {
  const existing = await prisma.assessmentComponent.findFirst({ where: { schoolId, id } });
  if (!existing) throw new Error("Assessment component not found");
  await prisma.assessmentComponent.delete({ where: { id } });
}

function gradeFor(bands: { grade: string; minScore: number; maxScore: number; remark: string }[], total: number) {
  return bands.find((b) => total >= b.minScore && total <= b.maxScore) ?? null;
}

// ---------------------------------------------------------------------------
// Score entry
// ---------------------------------------------------------------------------

export async function getScoreEntryGrid(schoolId: string, classArmId: string, subjectId: string, termId: string) {
  const [students, components, scores] = await Promise.all([
    prisma.student.findMany({ where: { schoolId, classArmId, status: "ACTIVE" }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    prisma.assessmentComponent.findMany({ where: { schoolId }, orderBy: { order: "asc" } }),
    prisma.score.findMany({ where: { schoolId, subjectId, termId, student: { classArmId } } }),
  ]);

  const scoreByKey = new Map(scores.map((s) => [`${s.studentId}:${s.componentId}`, s]));

  return {
    components,
    rows: students.map((student) => ({
      student,
      values: components.map((c) => scoreByKey.get(`${student.id}:${c.id}`)?.value ?? null),
    })),
  };
}

export async function saveScores(
  schoolId: string,
  enteredById: string,
  input: { subjectId: string; termId: string; entries: { studentId: string; componentId: string; value: number }[] }
) {
  await prisma.$transaction(
    input.entries.map((e) =>
      prisma.score.upsert({
        where: { studentId_subjectId_termId_componentId: { studentId: e.studentId, subjectId: input.subjectId, termId: input.termId, componentId: e.componentId } },
        create: { schoolId, studentId: e.studentId, subjectId: input.subjectId, termId: input.termId, componentId: e.componentId, value: e.value, enteredById },
        update: { value: e.value, enteredById },
      })
    )
  );
}

// ---------------------------------------------------------------------------
// Report cards
// ---------------------------------------------------------------------------

export async function computeReportCard(schoolId: string, studentId: string, termId: string) {
  const student = await prisma.student.findFirst({
    where: { schoolId, id: studentId },
    include: { classArm: { include: { classGroup: true } } },
  });
  if (!student) throw new Error("Student not found");

  const [components, bands, allClassScores, term] = await Promise.all([
    prisma.assessmentComponent.findMany({ where: { schoolId } }),
    listGradeBands(schoolId),
    student.classArmId
      ? prisma.score.findMany({
          where: { schoolId, termId, student: { classArmId: student.classArmId } },
          include: { subject: true },
        })
      : Promise.resolve([]),
    prisma.term.findFirst({ where: { schoolId, id: termId } }),
  ]);

  const maxTotal = components.reduce((sum, c) => sum + c.maxScore, 0);

  // Group scores by subject, then by student, so we can compute both this
  // student's total and the class average per subject in one pass.
  const bySubject = new Map<string, { name: string; byStudent: Map<string, number> }>();
  for (const score of allClassScores) {
    if (!bySubject.has(score.subjectId)) bySubject.set(score.subjectId, { name: score.subject.name, byStudent: new Map() });
    const entry = bySubject.get(score.subjectId)!;
    entry.byStudent.set(score.studentId, (entry.byStudent.get(score.studentId) ?? 0) + score.value);
  }

  const subjectRows = Array.from(bySubject.entries())
    .filter(([, s]) => s.byStudent.has(studentId))
    .map(([subjectId, s]) => {
      const total = s.byStudent.get(studentId)!;
      const classAverage = Math.round(
        Array.from(s.byStudent.values()).reduce((sum, v) => sum + v, 0) / s.byStudent.size
      );
      const band = gradeFor(bands, total);
      return { subjectId, subjectName: s.name, total, maxTotal, classAverage, grade: band?.grade ?? null, remark: band?.remark ?? null };
    })
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName));

  const overallAverage =
    subjectRows.length > 0 ? Math.round(subjectRows.reduce((sum, r) => sum + r.total, 0) / subjectRows.length) : null;

  // Position: rank by each classmate's own overall average across the
  // subjects they have scores for, among students with at least one score.
  const classmateAverages = new Map<string, number>();
  for (const [, s] of bySubject) {
    for (const [sid, total] of s.byStudent) {
      classmateAverages.set(sid, (classmateAverages.get(sid) ?? 0) + total);
    }
  }
  const ranked = Array.from(classmateAverages.entries()).sort((a, b) => b[1] - a[1]);
  const position = ranked.findIndex(([sid]) => sid === studentId);

  const reportCard = await prisma.reportCard.upsert({
    where: { studentId_termId: { studentId, termId } },
    create: { schoolId, studentId, termId },
    update: {},
  });

  return {
    student,
    term,
    reportCard,
    subjectRows,
    overallAverage,
    position: position >= 0 ? position + 1 : null,
    classSize: ranked.length,
  };
}

export async function updateReportCardComments(
  schoolId: string,
  studentId: string,
  termId: string,
  input: { teacherComment?: string | null; principalComment?: string | null }
) {
  await computeReportCard(schoolId, studentId, termId); // ensures the row exists
  return prisma.reportCard.update({
    where: { studentId_termId: { studentId, termId } },
    data: input,
  });
}

export async function approveReportCard(schoolId: string, approvedById: string, studentId: string, termId: string) {
  await computeReportCard(schoolId, studentId, termId);
  return prisma.reportCard.update({
    where: { studentId_termId: { studentId, termId } },
    data: { status: "APPROVED", approvedById, approvedAt: new Date() },
  });
}

export async function publishReportCard(schoolId: string, studentId: string, termId: string) {
  const existing = await prisma.reportCard.findFirst({ where: { schoolId, studentId, termId } });
  if (!existing || existing.status !== "APPROVED") {
    throw new Error("A report card must be approved before it can be published.");
  }
  const reportCard = await prisma.reportCard.update({
    where: { studentId_termId: { studentId, termId } },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });
  await notifyReportCardPublished(schoolId, studentId, termId);
  return reportCard;
}

export async function listReportCardsForClass(schoolId: string, classArmId: string, termId: string) {
  const students = await prisma.student.findMany({
    where: { schoolId, classArmId, status: "ACTIVE" },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const reportCards = await prisma.reportCard.findMany({ where: { schoolId, termId, studentId: { in: students.map((s) => s.id) } } });
  const byStudent = new Map(reportCards.map((r) => [r.studentId, r]));
  return students.map((student) => ({ student, reportCard: byStudent.get(student.id) ?? null }));
}
