import "server-only";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type {
  CBTExamStatus,
  CBTQuestionSelectionMode,
  CBTResultVisibility,
  CBTDifficulty,
} from "@/generated/prisma/client";

const PAGE_SIZE = 20;

/// Default, per-school-seeded exam types — the same "system-seeded but
/// tenant-editable" pattern as GradeBand/AssessmentComponent
/// (school-provisioning.ts), but applied lazily here (upsert-on-read)
/// instead of only at school creation, so schools provisioned before this
/// feature existed self-heal the first time anyone opens the exam wizard.
const DEFAULT_EXAM_TYPES = ["Test", "Exam", "Quiz", "Mock Exam"];

export async function listExamTypes(schoolId: string) {
  await Promise.all(
    DEFAULT_EXAM_TYPES.map((label) =>
      prisma.cBTExamTypeOption.upsert({
        where: { schoolId_key: { schoolId, key: label.toUpperCase().replace(/\s+/g, "_") } },
        create: { schoolId, key: label.toUpperCase().replace(/\s+/g, "_"), label, isSystem: true },
        update: {},
      })
    )
  );
  return prisma.cBTExamTypeOption.findMany({ where: { schoolId }, orderBy: [{ isSystem: "desc" }, { label: "asc" }] });
}

export async function createExamType(schoolId: string, label: string) {
  const trimmed = label.trim();
  if (!trimmed) throw new Error("Exam type name is required.");
  const key = trimmed.toUpperCase().replace(/\s+/g, "_");
  return prisma.cBTExamTypeOption.upsert({
    where: { schoolId_key: { schoolId, key } },
    create: { schoolId, key, label: trimmed, isSystem: false },
    update: {},
  });
}

export async function listClassArmsForCandidates(schoolId: string) {
  const arms = await prisma.classArm.findMany({
    where: { schoolId },
    include: { classGroup: true, _count: { select: { students: { where: { status: "ACTIVE" } } } } },
    orderBy: [{ classGroup: { order: "asc" } }, { name: "asc" }],
  });
  return arms.map((a) => ({ id: a.id, name: `${a.classGroup.name} ${a.name}`, activeStudentCount: a._count.students }));
}

export async function listApprovedQuestionsForSubject(schoolId: string, subjectId: string) {
  return prisma.cBTQuestion.findMany({
    where: { schoolId, subjectId, status: "APPROVED" },
    select: { id: true, prompt: true, type: true, difficulty: true, marks: true, topic: true },
    orderBy: { createdAt: "desc" },
  });
}

/// Lazy status reconciliation on every read — same rationale as
/// entitlements.ts's subscription reconcile(): no background job runner,
/// so a time-driven transition (PUBLISHED -> LIVE at startAt, LIVE ->
/// ENDED at endAt) is applied, and persisted, the next time anything asks
/// about this exam. GRADING/COMPLETED are set explicitly once submission/
/// grading (Phase 5) is done, not time-driven, so this never sets them.
async function reconcileExamStatus<T extends { id: string; status: CBTExamStatus; startAt: Date; endAt: Date }>(
  exam: T
): Promise<T> {
  const now = new Date();
  let nextStatus: CBTExamStatus | null = null;
  if (exam.status === "PUBLISHED" && exam.startAt <= now) nextStatus = "LIVE";
  else if (exam.status === "LIVE" && exam.endAt <= now) nextStatus = "ENDED";
  else if (exam.status === "PUBLISHED" && exam.endAt <= now) nextStatus = "ENDED";

  if (!nextStatus) return exam;
  await prisma.cBTExam.update({ where: { id: exam.id }, data: { status: nextStatus } });
  return { ...exam, status: nextStatus };
}

export interface ExamListFilters {
  search?: string;
  subjectId?: string;
  termId?: string;
  status?: CBTExamStatus;
  page?: number;
}

export async function listExams(schoolId: string, filters: ExamListFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const where: Prisma.CBTExamWhereInput = {
    schoolId,
    ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
    ...(filters.termId ? { termId: filters.termId } : {}),
    ...(filters.status ? { status: filters.status } : { status: { not: "ARCHIVED" } }),
    ...(filters.search ? { title: { contains: filters.search, mode: "insensitive" } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.cBTExam.findMany({
      where,
      include: { subject: true, examType: true, term: true, _count: { select: { candidates: true, examQuestions: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.cBTExam.count({ where }),
  ]);

  const exams = await Promise.all(rows.map((exam) => reconcileExamStatus(exam)));
  return { exams, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getExam(schoolId: string, id: string) {
  const exam = await prisma.cBTExam.findFirst({
    where: { schoolId, id },
    include: {
      subject: true,
      examType: true,
      term: true,
      assessmentComponent: true,
      createdBy: { select: { name: true } },
      publishedBy: { select: { name: true } },
      examQuestions: { include: { question: true }, orderBy: { order: "asc" } },
      blueprint: { include: { rules: true } },
      candidates: { include: { student: { select: { firstName: true, lastName: true, admissionNumber: true } } } },
      _count: { select: { candidates: true, examQuestions: true, attempts: true } },
    },
  });
  if (!exam) return null;
  return reconcileExamStatus(exam);
}

export interface BlueprintRuleInput {
  topic?: string | null;
  difficulty?: CBTDifficulty | null;
  count: number;
}

export interface ExamInput {
  title: string;
  examTypeId: string;
  subjectId: string;
  termId: string;
  assessmentComponentId?: string | null;
  instructions?: string | null;
  isPractice: boolean;
  questionSelectionMode: CBTQuestionSelectionMode;
  questionIds: string[];
  blueprintTotalQuestions?: number | null;
  blueprintRules: BlueprintRuleInput[];
  randomizeQuestionOrder: boolean;
  randomizeOptionOrder: boolean;
  negativeMarkingEnabled: boolean;
  negativeMarkPerWrong: number;
  startAt: Date;
  endAt: Date;
  durationMinutes: number;
  requireFullscreen: boolean;
  detectTabSwitch: boolean;
  restrictCopyPaste: boolean;
  restrictRightClick: boolean;
  maxAttempts: number;
  autoSubmitOnExpiry: boolean;
  desktopOnly: boolean;
  resultVisibility: CBTResultVisibility;
  showCorrectAnswers: boolean;
  showExplanations: boolean;
  showRanking: boolean;
  classArmIds: string[];
}

function validateExamInput(input: ExamInput) {
  if (input.endAt <= input.startAt) throw new Error("End time must be after the start time.");
  if (input.durationMinutes < 1) throw new Error("Duration must be at least 1 minute.");
  const windowMinutes = (input.endAt.getTime() - input.startAt.getTime()) / 60_000;
  if (input.durationMinutes > windowMinutes) {
    throw new Error("Duration cannot be longer than the window between start and end time.");
  }
  if (input.maxAttempts < 1) throw new Error("Max attempts must be at least 1.");

  if (input.questionSelectionMode === "MANUAL") {
    if (input.questionIds.length === 0) throw new Error("Select at least one question, or switch to blueprint mode.");
  } else {
    if (input.blueprintRules.length === 0) throw new Error("Add at least one blueprint rule.");
    const ruleSum = input.blueprintRules.reduce((sum, r) => sum + r.count, 0);
    if (ruleSum !== (input.blueprintTotalQuestions ?? 0)) {
      throw new Error("The blueprint rule counts must add up to the total question count.");
    }
    if (input.blueprintRules.some((r) => r.count < 1)) throw new Error("Every blueprint rule needs a count of at least 1.");
  }

  if (input.negativeMarkingEnabled && input.negativeMarkPerWrong <= 0) {
    throw new Error("Set a positive mark deduction for negative marking, or turn it off.");
  }
}

/// Snapshots the currently-ACTIVE students of the selected class arms into
/// CBTExamCandidate rows. A student added to the class after this point
/// won't automatically become a candidate — that mirrors createAssignment's
/// same one-time-snapshot behavior for AssignmentSubmission, and keeps
/// "who is sitting this exam" an explicit, auditable list rather than a
/// live query that could silently change after the exam is published.
async function resolveCandidateStudentIds(schoolId: string, classArmIds: string[]): Promise<string[]> {
  if (classArmIds.length === 0) return [];
  const students = await prisma.student.findMany({
    where: { schoolId, classArmId: { in: classArmIds }, status: "ACTIVE" },
    select: { id: true },
  });
  return students.map((s) => s.id);
}

function computeManualTotalMarks(
  questionIds: string[],
  questions: { id: string; marks: number }[]
): number {
  const marksById = new Map(questions.map((q) => [q.id, q.marks]));
  return questionIds.reduce((sum, id) => sum + (marksById.get(id) ?? 0), 0);
}

export async function createExam(schoolId: string, createdById: string, input: ExamInput) {
  validateExamInput(input);

  let totalMarks = 0;
  let manualQuestions: { id: string; marks: number }[] = [];
  if (input.questionSelectionMode === "MANUAL") {
    manualQuestions = await prisma.cBTQuestion.findMany({
      where: { schoolId, id: { in: input.questionIds }, status: "APPROVED" },
      select: { id: true, marks: true },
    });
    if (manualQuestions.length !== input.questionIds.length) {
      throw new Error("One or more selected questions are no longer available.");
    }
    totalMarks = computeManualTotalMarks(input.questionIds, manualQuestions);
  }

  const candidateStudentIds = await resolveCandidateStudentIds(schoolId, input.classArmIds);

  return prisma.$transaction(async (tx) => {
    const exam = await tx.cBTExam.create({
      data: {
        schoolId,
        title: input.title,
        examTypeId: input.examTypeId,
        subjectId: input.subjectId,
        termId: input.termId,
        assessmentComponentId: input.assessmentComponentId || null,
        instructions: input.instructions || null,
        isPractice: input.isPractice,
        status: "DRAFT",
        questionSelectionMode: input.questionSelectionMode,
        totalMarks,
        randomizeQuestionOrder: input.randomizeQuestionOrder,
        randomizeOptionOrder: input.randomizeOptionOrder,
        negativeMarkingEnabled: input.negativeMarkingEnabled,
        negativeMarkPerWrong: input.negativeMarkingEnabled ? input.negativeMarkPerWrong : 0,
        startAt: input.startAt,
        endAt: input.endAt,
        durationMinutes: input.durationMinutes,
        requireFullscreen: input.requireFullscreen,
        detectTabSwitch: input.detectTabSwitch,
        restrictCopyPaste: input.restrictCopyPaste,
        restrictRightClick: input.restrictRightClick,
        maxAttempts: input.maxAttempts,
        autoSubmitOnExpiry: input.autoSubmitOnExpiry,
        desktopOnly: input.desktopOnly,
        resultVisibility: input.resultVisibility,
        showCorrectAnswers: input.showCorrectAnswers,
        showExplanations: input.showExplanations,
        showRanking: input.showRanking,
        createdById,
      },
    });

    if (input.questionSelectionMode === "MANUAL") {
      await tx.cBTExamQuestion.createMany({
        data: input.questionIds.map((questionId, i) => ({ examId: exam.id, questionId, order: i })),
      });
    } else {
      const blueprint = await tx.cBTExamBlueprint.create({
        data: { examId: exam.id, totalQuestions: input.blueprintTotalQuestions ?? 0 },
      });
      await tx.cBTExamBlueprintRule.createMany({
        data: input.blueprintRules.map((r) => ({
          blueprintId: blueprint.id,
          topic: r.topic || null,
          difficulty: r.difficulty || null,
          count: r.count,
        })),
      });
    }

    if (candidateStudentIds.length > 0) {
      await tx.cBTExamCandidate.createMany({
        data: candidateStudentIds.map((studentId) => ({ examId: exam.id, studentId, schoolId })),
        skipDuplicates: true,
      });
    }

    return exam;
  });
}

/// Full edits are only ever allowed while an exam is still DRAFT — the
/// moment it's PUBLISHED (let alone LIVE), its questions/answer-keys/
/// duration are protected (spec section 43). To change anything on a
/// published exam, unpublishExam() first.
export async function updateExam(schoolId: string, id: string, input: ExamInput) {
  const existing = await prisma.cBTExam.findFirst({ where: { schoolId, id } });
  if (!existing) throw new Error("Exam not found.");
  if (existing.status !== "DRAFT") throw new Error("Only draft exams can be edited. Unpublish it first.");

  validateExamInput(input);

  let totalMarks = 0;
  if (input.questionSelectionMode === "MANUAL") {
    const manualQuestions = await prisma.cBTQuestion.findMany({
      where: { schoolId, id: { in: input.questionIds }, status: "APPROVED" },
      select: { id: true, marks: true },
    });
    if (manualQuestions.length !== input.questionIds.length) {
      throw new Error("One or more selected questions are no longer available.");
    }
    totalMarks = computeManualTotalMarks(input.questionIds, manualQuestions);
  }

  const candidateStudentIds = await resolveCandidateStudentIds(schoolId, input.classArmIds);

  return prisma.$transaction(async (tx) => {
    await tx.cBTExamQuestion.deleteMany({ where: { examId: id } });
    await tx.cBTExamBlueprint.deleteMany({ where: { examId: id } }); // cascades to rules
    await tx.cBTExamCandidate.deleteMany({ where: { examId: id } });

    if (input.questionSelectionMode === "MANUAL") {
      await tx.cBTExamQuestion.createMany({
        data: input.questionIds.map((questionId, i) => ({ examId: id, questionId, order: i })),
      });
    } else {
      const blueprint = await tx.cBTExamBlueprint.create({
        data: { examId: id, totalQuestions: input.blueprintTotalQuestions ?? 0 },
      });
      await tx.cBTExamBlueprintRule.createMany({
        data: input.blueprintRules.map((r) => ({
          blueprintId: blueprint.id,
          topic: r.topic || null,
          difficulty: r.difficulty || null,
          count: r.count,
        })),
      });
    }

    if (candidateStudentIds.length > 0) {
      await tx.cBTExamCandidate.createMany({
        data: candidateStudentIds.map((studentId) => ({ examId: id, studentId, schoolId })),
        skipDuplicates: true,
      });
    }

    return tx.cBTExam.update({
      where: { id },
      data: {
        title: input.title,
        examTypeId: input.examTypeId,
        subjectId: input.subjectId,
        termId: input.termId,
        assessmentComponentId: input.assessmentComponentId || null,
        instructions: input.instructions || null,
        isPractice: input.isPractice,
        questionSelectionMode: input.questionSelectionMode,
        totalMarks,
        randomizeQuestionOrder: input.randomizeQuestionOrder,
        randomizeOptionOrder: input.randomizeOptionOrder,
        negativeMarkingEnabled: input.negativeMarkingEnabled,
        negativeMarkPerWrong: input.negativeMarkingEnabled ? input.negativeMarkPerWrong : 0,
        startAt: input.startAt,
        endAt: input.endAt,
        durationMinutes: input.durationMinutes,
        requireFullscreen: input.requireFullscreen,
        detectTabSwitch: input.detectTabSwitch,
        restrictCopyPaste: input.restrictCopyPaste,
        restrictRightClick: input.restrictRightClick,
        maxAttempts: input.maxAttempts,
        autoSubmitOnExpiry: input.autoSubmitOnExpiry,
        desktopOnly: input.desktopOnly,
        resultVisibility: input.resultVisibility,
        showCorrectAnswers: input.showCorrectAnswers,
        showExplanations: input.showExplanations,
        showRanking: input.showRanking,
      },
    });
  });
}

export async function publishExam(schoolId: string, publishedById: string, id: string) {
  const exam = await prisma.cBTExam.findFirst({
    where: { schoolId, id },
    include: { examQuestions: true, blueprint: { include: { rules: true } }, _count: { select: { candidates: true } } },
  });
  if (!exam) throw new Error("Exam not found.");
  if (exam.status !== "DRAFT") throw new Error("Only draft exams can be published.");
  if (exam.questionSelectionMode === "MANUAL" && exam.examQuestions.length === 0) {
    throw new Error("Add at least one question before publishing.");
  }
  if (exam.questionSelectionMode === "BLUEPRINT" && (!exam.blueprint || exam.blueprint.rules.length === 0)) {
    throw new Error("Add at least one blueprint rule before publishing.");
  }
  if (exam._count.candidates === 0) throw new Error("Assign at least one candidate before publishing.");
  if (exam.endAt <= new Date()) throw new Error("This exam's end time is already in the past.");

  return prisma.cBTExam.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date(), publishedById },
  });
}

/// Only reversible before the exam actually starts — once LIVE, pulling
/// it back to DRAFT would yank an exam out from under students who may
/// already be mid-attempt, so that path doesn't exist.
export async function unpublishExam(schoolId: string, id: string) {
  const exam = await prisma.cBTExam.findFirst({ where: { schoolId, id } });
  if (!exam) throw new Error("Exam not found.");
  if (exam.status !== "PUBLISHED") throw new Error("Only published (not yet started) exams can be unpublished.");
  if (exam.startAt <= new Date()) throw new Error("This exam has already started and can no longer be unpublished.");

  return prisma.cBTExam.update({
    where: { id },
    data: { status: "DRAFT", publishedAt: null, publishedById: null },
  });
}

export async function archiveExam(schoolId: string, id: string) {
  const exam = await prisma.cBTExam.findFirst({ where: { schoolId, id } });
  if (!exam) throw new Error("Exam not found.");
  if (exam.status === "LIVE") throw new Error("Cannot archive an exam that is currently live.");
  return prisma.cBTExam.update({ where: { id }, data: { status: "ARCHIVED" } });
}

export async function deleteExam(schoolId: string, id: string) {
  const exam = await prisma.cBTExam.findFirst({ where: { schoolId, id } });
  if (!exam) throw new Error("Exam not found.");
  if (exam.status !== "DRAFT") throw new Error("Only draft exams can be deleted. Archive it instead.");
  await prisma.cBTExam.delete({ where: { id } });
}

/// Sets the candidate's total extra time (not an increment) and records
/// who granted it and why (spec section 41 — explicit, audited, never
/// student-initiated). If the candidate has an attempt already
/// IN_PROGRESS, its deadlineAt — the sole authority for time remaining
/// (schema doc-comment on CBTAttempt.deadlineAt) — is shifted by the
/// delta so the extension actually takes effect mid-sitting rather than
/// only benefiting a future attempt.
export async function grantExamExtension(
  schoolId: string,
  grantedById: string,
  candidateId: string,
  extraTimeMinutes: number,
  reason: string | null
) {
  if (extraTimeMinutes < 0) throw new Error("Extra time cannot be negative.");
  const candidate = await prisma.cBTExamCandidate.findFirst({ where: { schoolId, id: candidateId } });
  if (!candidate) throw new Error("Candidate not found.");

  const deltaMinutes = extraTimeMinutes - candidate.extraTimeMinutes;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.cBTExamCandidate.update({
      where: { id: candidateId },
      data: { extraTimeMinutes, extensionReason: reason, extensionGrantedById: grantedById },
    });

    if (deltaMinutes !== 0) {
      const inProgress = await tx.cBTAttempt.findFirst({ where: { candidateId, status: "IN_PROGRESS" } });
      if (inProgress) {
        await tx.cBTAttempt.update({
          where: { id: inProgress.id },
          data: { deadlineAt: new Date(inProgress.deadlineAt.getTime() + deltaMinutes * 60_000) },
        });
      }
    }

    return updated;
  });
}
