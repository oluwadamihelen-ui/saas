import "server-only";
import { prisma } from "@/lib/db";
import { notifyPreschoolReportPublished } from "@/lib/services/notifications";
import type { PreschoolAssessmentLevel, PreschoolAssessmentPeriodType } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Pre-School Milestone Results — the developmental/behavioural counterpart
// to results.ts's numerical Score/ReportCard system. Nothing in this file
// is read by results.ts, computeReportCard, or generateReportCardPdfBuffer,
// and nothing there is read by this file — the two tracks are independent,
// selected per ClassGroup via assessmentMode.
// ---------------------------------------------------------------------------

/// Fallback wording/colour for a level when a school hasn't overridden it
/// via PreschoolAssessmentLevelLabel — see listAssessmentLevels below. The
/// LEVEL CODES themselves (the enum) never change per school; only this
/// display layer does.
export const PRESCHOOL_LEVEL_DEFAULTS: Record<PreschoolAssessmentLevel, { label: string; colorVariant: string; order: number }> = {
  EXCEEDED: { label: "Excellent / Exceeded Expectations", colorVariant: "success", order: 0 },
  ACHIEVED: { label: "Very Good / Achieved", colorVariant: "accent", order: 1 },
  PROGRESSING: { label: "Good / Progressing", colorVariant: "secondary", order: 2 },
  DEVELOPING: { label: "Developing", colorVariant: "warning", order: 3 },
  NEEDS_SUPPORT: { label: "Needs Support", colorVariant: "danger", order: 4 },
};

const LEVEL_ORDER: PreschoolAssessmentLevel[] = ["EXCEEDED", "ACHIEVED", "PROGRESSING", "DEVELOPING", "NEEDS_SUPPORT"];

export async function listAssessmentLevels(schoolId: string) {
  const overrides = await prisma.preschoolAssessmentLevelLabel.findMany({ where: { schoolId } });
  const byLevel = new Map(overrides.map((o) => [o.level, o]));
  return LEVEL_ORDER.map((level) => {
    const override = byLevel.get(level);
    const fallback = PRESCHOOL_LEVEL_DEFAULTS[level];
    return {
      level,
      label: override?.label ?? fallback.label,
      colorVariant: override?.colorVariant ?? fallback.colorVariant,
      order: fallback.order,
    };
  });
}

export async function upsertAssessmentLevelLabel(
  schoolId: string,
  level: PreschoolAssessmentLevel,
  input: { label: string; colorVariant: string }
) {
  return prisma.preschoolAssessmentLevelLabel.upsert({
    where: { schoolId_level: { schoolId, level } },
    create: { schoolId, level, label: input.label.trim(), colorVariant: input.colorVariant },
    update: { label: input.label.trim(), colorVariant: input.colorVariant },
  });
}

// ---------------------------------------------------------------------------
// Assessment periods
// ---------------------------------------------------------------------------

export async function listAssessmentPeriods(schoolId: string, termId: string) {
  return prisma.preschoolAssessmentPeriod.findMany({ where: { schoolId, termId }, orderBy: { createdAt: "asc" } });
}

export async function createAssessmentPeriod(
  schoolId: string,
  termId: string,
  input: { name: string; type: PreschoolAssessmentPeriodType }
) {
  const term = await prisma.term.findFirst({ where: { schoolId, id: termId } });
  if (!term) throw new Error("Term not found.");
  const existing = await prisma.preschoolAssessmentPeriod.findFirst({ where: { schoolId, termId, name: input.name.trim() } });
  if (existing) throw new Error(`An assessment period named "${input.name}" already exists for this term.`);
  return prisma.preschoolAssessmentPeriod.create({ data: { schoolId, termId, name: input.name.trim(), type: input.type } });
}

// ---------------------------------------------------------------------------
// Class assessment grid — the teacher workflow (brief section 6/7)
// ---------------------------------------------------------------------------

export interface MilestoneAssessmentGridEntry {
  studentId: string;
  milestoneId: string;
  level: PreschoolAssessmentLevel | null;
  comment: string | null;
  assessedAt: Date | null;
}

/// Mirrors getScoreEntryGrid's shape: milestones as columns (from the
/// ACTIVE ones only — archived milestones are excluded from new-entry
/// grids but remain visible in historical reports), students as rows, one
/// existing-or-null cell per (student, milestone) for the chosen period.
export async function getMilestoneAssessmentGrid(
  schoolId: string,
  classArmId: string,
  subjectId: string,
  termId: string,
  assessmentPeriodId: string
) {
  const classArm = await prisma.classArm.findFirst({ where: { schoolId, id: classArmId }, include: { classGroup: true } });
  if (!classArm) throw new Error("Class not found.");

  const [scheme, students] = await Promise.all([
    getSchemeOfWorkForGrid(schoolId, termId, classArm.classGroupId, subjectId),
    prisma.student.findMany({ where: { schoolId, classArmId, status: "ACTIVE" }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
  ]);

  const milestones = scheme?.topics.flatMap((t) => t.milestones.map((m) => ({ ...m, topicTitle: t.title, weekNumber: t.weekNumber }))) ?? [];
  const milestoneIds = milestones.map((m) => m.id);

  const existing =
    milestoneIds.length === 0
      ? []
      : await prisma.preschoolMilestoneAssessment.findMany({
          where: { schoolId, assessmentPeriodId, milestoneId: { in: milestoneIds }, studentId: { in: students.map((s) => s.id) } },
        });
  const byKey = new Map(existing.map((a) => [`${a.studentId}:${a.milestoneId}`, a]));

  return {
    scheme,
    milestones,
    rows: students.map((student) => ({
      student,
      values: milestones.map((m) => {
        const a = byKey.get(`${student.id}:${m.id}`);
        return { milestoneId: m.id, level: a?.level ?? null, comment: a?.comment ?? null, assessedAt: a?.assessedAt ?? null };
      }),
    })),
  };
}

async function getSchemeOfWorkForGrid(schoolId: string, termId: string, classGroupId: string, subjectId: string) {
  return prisma.schemeOfWork.findUnique({
    where: { schoolId_termId_classGroupId_subjectId: { schoolId, termId, classGroupId, subjectId } },
    include: {
      topics: {
        where: { milestones: { some: { status: "ACTIVE" } } },
        orderBy: [{ order: "asc" }, { weekNumber: "asc" }],
        include: { milestones: { where: { status: "ACTIVE" }, orderBy: { order: "asc" } } },
      },
    },
  });
}

export interface SaveMilestoneAssessmentsInput {
  subjectId: string;
  termId: string;
  assessmentPeriodId: string;
  entries: { studentId: string; milestoneId: string; level: PreschoolAssessmentLevel; comment?: string | null }[];
}

/// Result locking (brief section 23): once a student's PreschoolReport for
/// this term is APPROVED or PUBLISHED, an ordinary teacher (canOverrideLock
/// = false, i.e. no RESULTS_APPROVE) can no longer silently change what's
/// already been signed off — the action layer decides canOverrideLock from
/// the acting user's permissions, same pattern as updateCommentsAction's
/// canSetPrincipalComment in results/actions.ts.
export async function saveMilestoneAssessments(
  schoolId: string,
  assessedById: string,
  canOverrideLock: boolean,
  input: SaveMilestoneAssessmentsInput
) {
  if (input.entries.length === 0) throw new Error("No assessments to save.");

  const studentIds = [...new Set(input.entries.map((e) => e.studentId))];
  if (!canOverrideLock) {
    const lockedReports = await prisma.preschoolReport.findMany({
      where: { schoolId, termId: input.termId, studentId: { in: studentIds }, status: { in: ["APPROVED", "PUBLISHED"] } },
      include: { student: { select: { firstName: true, lastName: true } } },
    });
    if (lockedReports.length > 0) {
      const names = lockedReports.map((r) => `${r.student.firstName} ${r.student.lastName}`).join(", ");
      throw new Error(`${names}'s milestone report has already been approved — ask an approver to reopen it before changing results.`);
    }
  }

  await prisma.$transaction(
    input.entries.map((e) =>
      prisma.preschoolMilestoneAssessment.upsert({
        where: { studentId_milestoneId_assessmentPeriodId: { studentId: e.studentId, milestoneId: e.milestoneId, assessmentPeriodId: input.assessmentPeriodId } },
        create: {
          schoolId,
          studentId: e.studentId,
          milestoneId: e.milestoneId,
          subjectId: input.subjectId,
          termId: input.termId,
          assessmentPeriodId: input.assessmentPeriodId,
          level: e.level,
          comment: e.comment || null,
          assessedById,
        },
        update: { level: e.level, comment: e.comment || null, assessedById, assessedAt: new Date() },
      })
    )
  );
}

// ---------------------------------------------------------------------------
// Previously-assessed milestone lookup (brief section 10) — lets the UI warn
// "already assessed in Test on 12 Sep" instead of silently re-assessing.
// ---------------------------------------------------------------------------

export async function listMilestoneAssessmentHistory(schoolId: string, studentId: string, milestoneId: string) {
  return prisma.preschoolMilestoneAssessment.findMany({
    where: { schoolId, studentId, milestoneId },
    include: { assessmentPeriod: true, assessedBy: { select: { name: true } } },
    orderBy: { assessedAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
// Report computation + workflow — mirrors computeReportCard/ReportCard
// exactly (content always recomputed live, never cached on the row).
// ---------------------------------------------------------------------------

export async function computePreschoolReport(schoolId: string, studentId: string, termId: string) {
  const student = await prisma.student.findFirst({
    where: { schoolId, id: studentId },
    include: { classArm: { include: { classGroup: true } } },
  });
  if (!student) throw new Error("Student not found");

  const [assessments, term] = await Promise.all([
    prisma.preschoolMilestoneAssessment.findMany({
      where: { schoolId, studentId, termId },
      include: {
        milestone: { include: { topic: true } },
        subject: true,
        assessmentPeriod: true,
      },
      orderBy: { assessedAt: "asc" },
    }),
    prisma.term.findFirst({ where: { schoolId, id: termId } }),
  ]);

  // One row per milestone in the report — the most recent assessment of it
  // (a milestone assessed in both Test and Examination shows its latest
  // state; the full history is still available via
  // listMilestoneAssessmentHistory for anyone who needs to see progression).
  const latestByMilestone = new Map<string, (typeof assessments)[number]>();
  for (const a of assessments) latestByMilestone.set(a.milestoneId, a);

  const bySubject = new Map<
    string,
    { subjectName: string; topics: Map<string, { topicTitle: string; weekNumber: number; milestones: typeof assessments }> }
  >();
  for (const a of latestByMilestone.values()) {
    if (!bySubject.has(a.subjectId)) bySubject.set(a.subjectId, { subjectName: a.subject.name, topics: new Map() });
    const subjectEntry = bySubject.get(a.subjectId)!;
    const topicId = a.milestone.topicId;
    if (!subjectEntry.topics.has(topicId)) {
      subjectEntry.topics.set(topicId, { topicTitle: a.milestone.topic.title, weekNumber: a.milestone.topic.weekNumber, milestones: [] });
    }
    subjectEntry.topics.get(topicId)!.milestones.push(a);
  }

  const subjects = Array.from(bySubject.entries())
    .map(([subjectId, s]) => ({
      subjectId,
      subjectName: s.subjectName,
      topics: Array.from(s.topics.values())
        .sort((a, b) => a.weekNumber - b.weekNumber)
        .map((t) => ({
          topicTitle: t.topicTitle,
          weekNumber: t.weekNumber,
          milestones: t.milestones
            .sort((a, b) => a.milestone.order - b.milestone.order)
            .map((a) => ({
              milestoneId: a.milestoneId,
              title: a.milestone.title,
              level: a.level,
              comment: a.comment,
              assessmentPeriod: a.assessmentPeriod.name,
              assessedAt: a.assessedAt,
            })),
        })),
    }))
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName));

  const summary = LEVEL_ORDER.reduce(
    (acc, level) => ({ ...acc, [level]: 0 }),
    {} as Record<PreschoolAssessmentLevel, number>
  );
  for (const a of latestByMilestone.values()) summary[a.level]++;

  const report = await prisma.preschoolReport.upsert({
    where: { studentId_termId: { studentId, termId } },
    create: { schoolId, studentId, termId },
    update: {},
  });

  return {
    student,
    term,
    report,
    subjects,
    summary,
    totalMilestonesAssessed: latestByMilestone.size,
    assessmentMode: student.classArm?.classGroup.assessmentMode ?? "NUMERICAL",
  };
}

export async function updatePreschoolReportComments(
  schoolId: string,
  studentId: string,
  termId: string,
  input: { overallComment?: string | null; teacherComment?: string | null; principalComment?: string | null }
) {
  await computePreschoolReport(schoolId, studentId, termId); // ensures the row exists
  return prisma.preschoolReport.update({
    where: { studentId_termId: { studentId, termId } },
    data: input,
  });
}

export async function submitPreschoolReport(schoolId: string, submittedById: string, studentId: string, termId: string) {
  await computePreschoolReport(schoolId, studentId, termId);
  return prisma.preschoolReport.update({
    where: { studentId_termId: { studentId, termId } },
    data: { status: "SUBMITTED", submittedById, submittedAt: new Date() },
  });
}

export async function approvePreschoolReport(schoolId: string, approvedById: string, studentId: string, termId: string) {
  await computePreschoolReport(schoolId, studentId, termId);
  return prisma.preschoolReport.update({
    where: { studentId_termId: { studentId, termId } },
    data: { status: "APPROVED", approvedById, approvedAt: new Date() },
  });
}

export async function publishPreschoolReport(schoolId: string, studentId: string, termId: string) {
  const existing = await prisma.preschoolReport.findFirst({ where: { schoolId, studentId, termId } });
  if (!existing || existing.status !== "APPROVED") {
    throw new Error("A milestone report must be approved before it can be published.");
  }
  const report = await prisma.preschoolReport.update({
    where: { studentId_termId: { studentId, termId } },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });
  await notifyPreschoolReportPublished(schoolId, studentId, termId);
  return report;
}

/// Reopens a published/approved report back to DRAFT so a teacher can
/// correct an entry — the counterpart to saveMilestoneAssessments' lock.
/// Callers gate this on RESULTS_APPROVE, same as approve/publish.
export async function reopenPreschoolReport(schoolId: string, studentId: string, termId: string) {
  const existing = await prisma.preschoolReport.findFirst({ where: { schoolId, studentId, termId } });
  if (!existing) throw new Error("Report not found.");
  return prisma.preschoolReport.update({
    where: { studentId_termId: { studentId, termId } },
    data: { status: "DRAFT", approvedById: null, approvedAt: null, publishedAt: null },
  });
}

export async function listPreschoolReportsForClass(schoolId: string, classArmId: string, termId: string) {
  const students = await prisma.student.findMany({
    where: { schoolId, classArmId, status: "ACTIVE" },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const reports = await prisma.preschoolReport.findMany({ where: { schoolId, termId, studentId: { in: students.map((s) => s.id) } } });
  const byStudent = new Map(reports.map((r) => [r.studentId, r]));
  return students.map((student) => ({ student, report: byStudent.get(student.id) ?? null }));
}

// ---------------------------------------------------------------------------
// Analytics (brief section 26) — counts, never percentages, unless a school
// explicitly wants numerical treatment (out of scope: this system is
// deliberately not numerical by default).
// ---------------------------------------------------------------------------

export async function getClassMilestoneProgress(schoolId: string, classArmId: string, termId: string) {
  const students = await prisma.student.findMany({ where: { schoolId, classArmId, status: "ACTIVE" }, select: { id: true } });
  if (students.length === 0) return { studentCount: 0, byLevel: {} as Record<PreschoolAssessmentLevel, number>, milestonesAssessed: 0 };

  const assessments = await prisma.preschoolMilestoneAssessment.findMany({
    where: { schoolId, termId, studentId: { in: students.map((s) => s.id) } },
    orderBy: { assessedAt: "asc" },
  });
  const latestByStudentMilestone = new Map<string, (typeof assessments)[number]>();
  for (const a of assessments) latestByStudentMilestone.set(`${a.studentId}:${a.milestoneId}`, a);

  const byLevel = LEVEL_ORDER.reduce((acc, level) => ({ ...acc, [level]: 0 }), {} as Record<PreschoolAssessmentLevel, number>);
  for (const a of latestByStudentMilestone.values()) byLevel[a.level]++;

  return { studentCount: students.length, byLevel, milestonesAssessed: latestByStudentMilestone.size };
}
