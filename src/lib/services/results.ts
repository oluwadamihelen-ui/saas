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

export function gradeFor(bands: { grade: string; minScore: number; maxScore: number; remark: string }[], total: number) {
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

/// classArmId is the class this batch of scores is actually being
/// entered for — always known by the caller (the score grid is itself
/// scoped to one class; CBT grading resolves the student's current class
/// at the moment of grading). Set on Score.classArmId only when the row
/// is first created (source "ENTERED" — this is live entry, not an
/// import); an update to an existing score changes its value only and
/// never touches classArmId/classArmSource, so correcting a score can
/// never rewrite which class it was historically for.
export async function saveScores(
  schoolId: string,
  enteredById: string,
  input: {
    subjectId: string;
    termId: string;
    classArmId?: string | null;
    entries: { studentId: string; componentId: string; value: number }[];
  }
) {
  await prisma.$transaction(
    input.entries.map((e) =>
      prisma.score.upsert({
        where: { studentId_subjectId_termId_componentId: { studentId: e.studentId, subjectId: input.subjectId, termId: input.termId, componentId: e.componentId } },
        create: {
          schoolId,
          studentId: e.studentId,
          subjectId: input.subjectId,
          termId: input.termId,
          componentId: e.componentId,
          value: e.value,
          enteredById,
          classArmId: input.classArmId || null,
          classArmSource: input.classArmId ? "ENTERED" : null,
        },
        update: { value: e.value, enteredById },
      })
    )
  );
}

// ---------------------------------------------------------------------------
// Report cards
// ---------------------------------------------------------------------------

/// The class arm most of a student's own scores for a term agree on —
/// almost always all of them, since a class-arm transfer mid-term is
/// rare, but "most" rather than "first" handles it without special-casing.
/// Null rows (pre-migration, or entered before this field existed) are
/// ignored rather than counted as their own bucket.
export function resolveDominantClassArmId(scores: { classArmId: string | null }[]): string | null {
  const counts = new Map<string, number>();
  for (const s of scores) {
    if (!s.classArmId) continue;
    counts.set(s.classArmId, (counts.get(s.classArmId) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [classArmId, count] of counts) {
    if (count > bestCount) {
      best = classArmId;
      bestCount = count;
    }
  }
  return best;
}

export async function computeReportCard(schoolId: string, studentId: string, termId: string) {
  const student = await prisma.student.findFirst({
    where: { schoolId, id: studentId },
    include: { classArm: { include: { classGroup: true } } },
  });
  if (!student) throw new Error("Student not found");

  // The class this report card is actually for — resolved from the
  // student's OWN scores for this term wherever they carry a verified
  // historical class (Score.classArmId), never from Student.classArmId
  // once that verified history exists, so a promoted student's past
  // report card keeps showing their past class.
  const ownScores = await prisma.score.findMany({ where: { schoolId, studentId, termId }, select: { classArmId: true } });
  const verifiedClassArmId = resolveDominantClassArmId(ownScores);

  const [components, bands, allClassScores, term] = await Promise.all([
    prisma.assessmentComponent.findMany({ where: { schoolId } }),
    listGradeBands(schoolId),
    // Classmates for the average/position below must be whoever was
    // ACTUALLY in this class this term. Where this student has a
    // verified historical class on their own scores, filter classmates
    // by that same Score.classArmId — the historically accurate answer.
    // Where none of their scores carry one yet (legacy data predating
    // this field, or a term with no classArmId ever recorded), there is
    // no verified history to filter by; fall back to the pre-existing
    // behavior of joining through the student's current class, exactly
    // as this always worked before — better than returning nothing.
    verifiedClassArmId
      ? prisma.score.findMany({ where: { schoolId, termId, classArmId: verifiedClassArmId }, include: { subject: true } })
      : student.classArmId
        ? prisma.score.findMany({ where: { schoolId, termId, student: { classArmId: student.classArmId } }, include: { subject: true } })
        : prisma.score.findMany({ where: { schoolId, studentId, termId }, include: { subject: true } }),
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
    create: {
      schoolId,
      studentId,
      termId,
      classArmId: verifiedClassArmId,
      classArmSource: verifiedClassArmId ? "ENTERED" : null,
    },
    update: {}, // classArmId is set once, at creation — never replaced by a later recompute
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
