import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  hasFeature,
  requireCbtActiveExamCapacity,
  getCbtActiveExamCount,
  requireCbtQuestionBankCapacity,
  getCbtQuestionBankCount,
  requireCbtAiCapacity,
  getCbtAiMonthlyUsage,
  getCbtCandidateUsage,
  requireCbtCandidateCapacity,
  CbtPlanLimitError,
} from "@/lib/billing/entitlements";
import { createQuestion } from "@/lib/services/cbt-questions";
import { createExam, publishExam } from "@/lib/services/cbt-exams";
import { createTestSchool, cleanupTestSchools } from "../helpers/factories";
import type { ExamInput } from "@/lib/services/cbt-exams";

afterAll(cleanupTestSchools);

let counter = 0;

/// A school on a custom plan with small, exact CBT limits — lets these
/// tests land on a boundary in a couple of calls instead of the hundreds
/// a real tier's own limit would take (StudentLimitError's own boundary
/// tests accept that cost for the real numbers; these deliberately don't
/// need to since the limit-enforcement *logic* under test here is
/// tier-independent). Every CBT boolean feature is granted so a
/// capacity check is what actually gets exercised, not requireFeature().
async function makeSchoolWithCbtLimits(limits: {
  cbtActiveExamLimit?: number | null;
  cbtQuestionBankLimit?: number | null;
  cbtAiQuestionsPerMonthLimit?: number | null;
  cbtCandidateLimit?: number | null;
}) {
  counter += 1;
  const slug = `vitest-cbtent-${Date.now()}-${counter}`;
  const plan = await prisma.subscriptionPlan.create({
    data: {
      slug: `${slug}-plan`,
      name: `${slug}-plan`,
      studentLimit: null,
      cbtActiveExamLimit: limits.cbtActiveExamLimit ?? null,
      cbtQuestionBankLimit: limits.cbtQuestionBankLimit ?? null,
      cbtAiQuestionsPerMonthLimit: limits.cbtAiQuestionsPerMonthLimit ?? null,
      cbtCandidateLimit: limits.cbtCandidateLimit ?? null,
      features: { cbt: true, cbt_question_bank: true, cbt_ai_generation: true, cbt_advanced_analytics: true },
    },
  });
  const school = await prisma.school.create({ data: { name: slug, slug, status: "ACTIVE" } });
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  await prisma.subscription.create({
    data: { schoolId: school.id, planId: plan.id, status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd: periodEnd },
  });

  const role = await prisma.role.create({ data: { schoolId: school.id, key: "TEACHER", name: "Teacher" } });
  const teacher = await prisma.user.create({
    data: { schoolId: school.id, roleId: role.id, email: `${slug}-t@vitest.local`, passwordHash: "x", name: "Teacher" },
  });
  const subject = await prisma.subject.create({ data: { schoolId: school.id, name: "Mathematics", code: "MTH" } });
  const session = await prisma.academicSession.create({
    data: { schoolId: school.id, name: "2025/2026", startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true },
  });
  const term = await prisma.term.create({
    data: { schoolId: school.id, academicSessionId: session.id, name: "First Term", startDate: new Date("2025-09-01"), endDate: new Date("2025-12-15"), isCurrent: true },
  });
  const classGroup = await prisma.classGroup.create({ data: { schoolId: school.id, name: "JSS2", order: 0 } });
  const classArm = await prisma.classArm.create({ data: { schoolId: school.id, classGroupId: classGroup.id, name: "A" } });
  const examType = await prisma.cBTExamTypeOption.create({ data: { schoolId: school.id, key: "TEST", label: "Test", isSystem: true } });

  return { school, teacher, subject, term, classArm, examType };
}

async function makeStudent(schoolId: string, classArmId: string, tag: string) {
  return prisma.student.create({
    data: { schoolId, classArmId, firstName: "S", lastName: tag, admissionNumber: `cand-${tag}-${Date.now()}-${Math.random()}`, dateOfBirth: new Date("2012-01-01"), gender: "MALE", status: "ACTIVE" },
  });
}

async function makeQuestion(schoolId: string, teacherId: string, subjectId: string, prompt: string) {
  return createQuestion(schoolId, teacherId, {
    subjectId,
    type: "MULTIPLE_CHOICE",
    difficulty: "EASY",
    prompt,
    marks: 4,
    options: [{ text: "3", isCorrect: false }, { text: "4", isCorrect: true }],
    tagNames: [],
  });
}

function baseExamInput(overrides: Partial<ExamInput> & Pick<ExamInput, "examTypeId" | "subjectId" | "termId" | "questionIds" | "classArmIds">): ExamInput {
  const now = Date.now();
  return {
    title: "Entitlement test exam",
    instructions: null,
    isPractice: false,
    questionSelectionMode: "MANUAL",
    blueprintTotalQuestions: null,
    blueprintRules: [],
    randomizeQuestionOrder: false,
    randomizeOptionOrder: false,
    negativeMarkingEnabled: false,
    negativeMarkPerWrong: 1,
    startAt: new Date(now - 60_000),
    endAt: new Date(now + 3600_000),
    durationMinutes: 30,
    requireFullscreen: false,
    detectTabSwitch: true,
    restrictCopyPaste: false,
    restrictRightClick: false,
    maxAttempts: 1,
    autoSubmitOnExpiry: true,
    desktopOnly: false,
    resultVisibility: "IMMEDIATE",
    showCorrectAnswers: false,
    showExplanations: false,
    showRanking: false,
    assessmentComponentId: null,
    ...overrides,
  };
}

describe("CBT feature access per tier", () => {
  it("Starter has cbt but not cbt_question_bank, cbt_ai_generation or cbt_advanced_analytics", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    expect(await hasFeature(school.id, "cbt")).toBe(true);
    expect(await hasFeature(school.id, "cbt_question_bank")).toBe(false);
    expect(await hasFeature(school.id, "cbt_ai_generation")).toBe(false);
    expect(await hasFeature(school.id, "cbt_advanced_analytics")).toBe(false);
  });

  it("Professional adds cbt_question_bank and cbt_ai_generation but not cbt_advanced_analytics", async () => {
    const { school } = await createTestSchool({ planTier: "PROFESSIONAL" });
    expect(await hasFeature(school.id, "cbt_question_bank")).toBe(true);
    expect(await hasFeature(school.id, "cbt_ai_generation")).toBe(true);
    expect(await hasFeature(school.id, "cbt_advanced_analytics")).toBe(false);
  });

  it("Premium adds cbt_advanced_analytics", async () => {
    const { school } = await createTestSchool({ planTier: "PREMIUM" });
    expect(await hasFeature(school.id, "cbt_advanced_analytics")).toBe(true);
  });
});

describe("CBT active-exam limit", () => {
  it("blocks publishing once the limit of currently PUBLISHED/LIVE exams is reached", async () => {
    const f = await makeSchoolWithCbtLimits({ cbtActiveExamLimit: 1 });
    await makeStudent(f.school.id, f.classArm.id, "1");
    const q = await makeQuestion(f.school.id, f.teacher.id, f.subject.id, "Q1");

    const exam1 = await createExam(
      f.school.id,
      f.teacher.id,
      baseExamInput({ examTypeId: f.examType.id, subjectId: f.subject.id, termId: f.term.id, questionIds: [q.id], classArmIds: [f.classArm.id] })
    );
    await expect(requireCbtActiveExamCapacity(f.school.id)).resolves.toBeUndefined();
    await publishExam(f.school.id, f.teacher.id, exam1.id); // 1 of 1 used

    const q2 = await makeQuestion(f.school.id, f.teacher.id, f.subject.id, "Q2");
    const exam2 = await createExam(
      f.school.id,
      f.teacher.id,
      baseExamInput({ examTypeId: f.examType.id, subjectId: f.subject.id, termId: f.term.id, questionIds: [q2.id], classArmIds: [f.classArm.id] })
    );
    expect(await getCbtActiveExamCount(f.school.id)).toBe(1);
    await expect(publishExam(f.school.id, f.teacher.id, exam2.id)).rejects.toBeInstanceOf(CbtPlanLimitError);
  });

  it("a DRAFT exam never counts against the limit — only publishing does", async () => {
    const f = await makeSchoolWithCbtLimits({ cbtActiveExamLimit: 0 });
    const q = await makeQuestion(f.school.id, f.teacher.id, f.subject.id, "Q1");
    await expect(
      createExam(f.school.id, f.teacher.id, baseExamInput({ examTypeId: f.examType.id, subjectId: f.subject.id, termId: f.term.id, questionIds: [q.id], classArmIds: [f.classArm.id] }))
    ).resolves.toBeTruthy();
    expect(await getCbtActiveExamCount(f.school.id)).toBe(0);
  });

  it("unlimited (null) never blocks", async () => {
    const f = await makeSchoolWithCbtLimits({ cbtActiveExamLimit: null });
    await expect(requireCbtActiveExamCapacity(f.school.id)).resolves.toBeUndefined();
  });
});

describe("CBT question bank limit", () => {
  it("blocks creating a question once the non-archived bank count reaches the limit", async () => {
    const f = await makeSchoolWithCbtLimits({ cbtQuestionBankLimit: 2 });
    await makeQuestion(f.school.id, f.teacher.id, f.subject.id, "Q1");
    await makeQuestion(f.school.id, f.teacher.id, f.subject.id, "Q2");
    expect(await getCbtQuestionBankCount(f.school.id)).toBe(2);
    await expect(makeQuestion(f.school.id, f.teacher.id, f.subject.id, "Q3")).rejects.toBeInstanceOf(CbtPlanLimitError);
  });

  it("a batch check (additionalCount) rejects up front when the whole batch would exceed the limit", async () => {
    const f = await makeSchoolWithCbtLimits({ cbtQuestionBankLimit: 3 });
    await makeQuestion(f.school.id, f.teacher.id, f.subject.id, "Q1");
    await expect(requireCbtQuestionBankCapacity(f.school.id, 3)).rejects.toBeInstanceOf(CbtPlanLimitError); // 1 existing + 3 new > 3
    await expect(requireCbtQuestionBankCapacity(f.school.id, 2)).resolves.toBeUndefined(); // 1 + 2 == 3, fits exactly
  });
});

describe("CBT AI questions per month limit", () => {
  it("counts only AI_GENERATED questions created since the start of this calendar month", async () => {
    const f = await makeSchoolWithCbtLimits({ cbtAiQuestionsPerMonthLimit: 2 });
    await prisma.cBTQuestion.create({
      data: { schoolId: f.school.id, subjectId: f.subject.id, type: "SHORT_ANSWER", status: "AI_PENDING_REVIEW", source: "AI_GENERATED", difficulty: "EASY", prompt: "AI Q1", marks: 2, createdById: f.teacher.id },
    });
    expect(await getCbtAiMonthlyUsage(f.school.id)).toBe(1);
    await expect(requireCbtAiCapacity(f.school.id, 1)).resolves.toBeUndefined(); // 1 + 1 == 2, fits
    await expect(requireCbtAiCapacity(f.school.id, 2)).rejects.toBeInstanceOf(CbtPlanLimitError); // 1 + 2 > 2

    // A manually-authored question never counts toward this limit, even at zero cap.
    await prisma.cBTQuestion.create({
      data: { schoolId: f.school.id, subjectId: f.subject.id, type: "SHORT_ANSWER", status: "APPROVED", source: "MANUAL", difficulty: "EASY", prompt: "Manual Q", marks: 2, createdById: f.teacher.id },
    });
    expect(await getCbtAiMonthlyUsage(f.school.id)).toBe(1);
  });
});

describe("CBT candidate limit", () => {
  it("counts distinct students across all exams in the term, not per-exam rows", async () => {
    const f = await makeSchoolWithCbtLimits({ cbtCandidateLimit: 2 });
    const s1 = await makeStudent(f.school.id, f.classArm.id, "1");
    const s2 = await makeStudent(f.school.id, f.classArm.id, "2");

    const q1 = await makeQuestion(f.school.id, f.teacher.id, f.subject.id, "Q1");
    const exam1 = await createExam(
      f.school.id,
      f.teacher.id,
      baseExamInput({ examTypeId: f.examType.id, subjectId: f.subject.id, termId: f.term.id, questionIds: [q1.id], classArmIds: [f.classArm.id] })
    );
    expect(await getCbtCandidateUsage(f.school.id, f.term.id)).toBe(2); // both active students in the class arm

    // A second exam re-using the SAME two students must not double-count them.
    const q2 = await makeQuestion(f.school.id, f.teacher.id, f.subject.id, "Q2");
    await expect(
      createExam(f.school.id, f.teacher.id, baseExamInput({ examTypeId: f.examType.id, subjectId: f.subject.id, termId: f.term.id, questionIds: [q2.id], classArmIds: [f.classArm.id] }))
    ).resolves.toBeTruthy();
    expect(await getCbtCandidateUsage(f.school.id, f.term.id)).toBe(2);

    // A third, previously-unseen student pushes the distinct count to 3 — over the limit of 2.
    const otherArm = await prisma.classArm.create({ data: { schoolId: f.school.id, classGroupId: (await prisma.classGroup.findFirstOrThrow({ where: { schoolId: f.school.id } })).id, name: "B" } });
    await makeStudent(f.school.id, otherArm.id, "3");
    const q3 = await makeQuestion(f.school.id, f.teacher.id, f.subject.id, "Q3");
    await expect(
      createExam(f.school.id, f.teacher.id, baseExamInput({ examTypeId: f.examType.id, subjectId: f.subject.id, termId: f.term.id, questionIds: [q3.id], classArmIds: [f.classArm.id, otherArm.id] }))
    ).rejects.toBeInstanceOf(CbtPlanLimitError);
    void exam1;
    void s1;
    void s2;
  });

  it("excludes the exam's own current candidates when re-saving it via updateExam", async () => {
    const f = await makeSchoolWithCbtLimits({ cbtCandidateLimit: 2 });
    await makeStudent(f.school.id, f.classArm.id, "1");
    await makeStudent(f.school.id, f.classArm.id, "2");
    const q = await makeQuestion(f.school.id, f.teacher.id, f.subject.id, "Q1");
    const exam = await createExam(
      f.school.id,
      f.teacher.id,
      baseExamInput({ examTypeId: f.examType.id, subjectId: f.subject.id, termId: f.term.id, questionIds: [q.id], classArmIds: [f.classArm.id] })
    );
    expect(await getCbtCandidateUsage(f.school.id, f.term.id)).toBe(2);

    // requireCbtCandidateCapacity with excludeExamId must not double-charge this exam's own 2 existing candidates.
    const studentIds = (await prisma.cBTExamCandidate.findMany({ where: { examId: exam.id }, select: { studentId: true } })).map((c) => c.studentId);
    await expect(requireCbtCandidateCapacity(f.school.id, f.term.id, studentIds, exam.id)).resolves.toBeUndefined();
  });
});
