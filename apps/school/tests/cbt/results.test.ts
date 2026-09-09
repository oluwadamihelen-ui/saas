import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createQuestion } from "@/lib/services/cbt-questions";
import { createExam, publishExam, listExamTypes } from "@/lib/services/cbt-exams";
import { startAttempt, saveAnswer, submitAttempt } from "@/lib/services/cbt-attempts";
import { getExamResultForStudent, releaseExamResults, getExamAnalytics } from "@/lib/services/cbt-results";
import { cleanupTestSchools, attachCbtSubscription } from "../helpers/factories";
import type { ExamInput } from "@/lib/services/cbt-exams";
import type { CBTResultVisibility } from "@/generated/prisma/client";

afterAll(cleanupTestSchools);

let counter = 0;

/// A school with one LIVE exam and TWO enrolled candidate students, plus
/// one MCQ question worth 4 marks — small and fully auto-gradable, so
/// each test only has to steer the *visibility* knobs, not re-derive
/// grading correctness (that's covered in grading.test.ts already).
async function makeResultsFixture(examOverrides: Partial<ExamInput> = {}) {
  counter += 1;
  const slug = `vitest-cbtresults-${Date.now()}-${counter}`;
  const school = await prisma.school.create({ data: { name: slug, slug, status: "ACTIVE" } });
  await attachCbtSubscription(school.id);
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

  async function makeStudent(label: string) {
    const studentRole = await prisma.role.create({ data: { schoolId: school.id, key: `STUDENT_${label}`, name: "Student" } });
    const studentUser = await prisma.user.create({
      data: { schoolId: school.id, roleId: studentRole.id, email: `${slug}-${label}@vitest.local`, passwordHash: "x", name: `Student ${label}` },
    });
    return prisma.student.create({
      data: {
        schoolId: school.id,
        classArmId: classArm.id,
        userId: studentUser.id,
        firstName: "Student",
        lastName: label,
        admissionNumber: `${slug}-${label}`,
        dateOfBirth: new Date("2012-01-01"),
        gender: "MALE",
        status: "ACTIVE",
      },
    });
  }
  const studentA = await makeStudent("A");
  const studentB = await makeStudent("B");
  const component = await prisma.assessmentComponent.create({ data: { schoolId: school.id, name: "CBT", maxScore: 100, order: 0 } });
  const [examType] = await listExamTypes(school.id);

  const mcq = await createQuestion(school.id, teacher.id, {
    subjectId: subject.id,
    type: "MULTIPLE_CHOICE",
    difficulty: "EASY",
    prompt: "2 + 2?",
    marks: 4,
    options: [{ text: "3", isCorrect: false }, { text: "4", isCorrect: true }],
    tagNames: [],
    explanation: "Basic addition.",
  });

  const now = Date.now();
  const input: ExamInput = {
    title: "Results exam",
    examTypeId: examType.id,
    subjectId: subject.id,
    termId: term.id,
    assessmentComponentId: component.id,
    instructions: null,
    isPractice: false,
    questionSelectionMode: "MANUAL",
    questionIds: [mcq.id],
    blueprintTotalQuestions: null,
    blueprintRules: [],
    randomizeQuestionOrder: false,
    randomizeOptionOrder: false,
    negativeMarkingEnabled: false,
    negativeMarkPerWrong: 0,
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
    resultVisibility: "AFTER_GRADING",
    showCorrectAnswers: false,
    showExplanations: false,
    showRanking: false,
    classArmIds: [classArm.id],
    ...examOverrides,
  };
  const exam = await createExam(school.id, teacher.id, input);
  await publishExam(school.id, teacher.id, exam.id);

  return { school, teacher, studentA, studentB, subject, term, component, exam, mcq };
}

async function answerCorrectlyAndSubmit(schoolId: string, studentId: string, examId: string, mcqId: string) {
  const attempt = await startAttempt(schoolId, studentId, examId);
  const options = await prisma.cBTQuestionOption.findMany({ where: { questionId: mcqId } });
  const correct = options.find((o) => o.isCorrect)!;
  await saveAnswer(schoolId, studentId, attempt.id, mcqId, correct.id);
  return submitAttempt(schoolId, studentId, attempt.id);
}

describe("CBT result visibility", () => {
  it("IMMEDIATE: visible the moment the student's own attempt is graded, independent of anyone else", async () => {
    const f = await makeResultsFixture({ resultVisibility: "IMMEDIATE" as CBTResultVisibility });
    await answerCorrectlyAndSubmit(f.school.id, f.studentA.id, f.exam.id, f.mcq.id);
    // studentB never attempts at all — must not block studentA's IMMEDIATE result.
    const result = await getExamResultForStudent(f.school.id, f.studentA.id, f.exam.id);
    expect(result?.status).toBe("visible");
    expect(result?.score).toBe(4);
  });

  it("AFTER_GRADING: hidden while another candidate's attempt is still pending, visible once everyone is graded", async () => {
    const f = await makeResultsFixture({ resultVisibility: "AFTER_GRADING" as CBTResultVisibility, maxAttempts: 1 });
    await answerCorrectlyAndSubmit(f.school.id, f.studentA.id, f.exam.id, f.mcq.id);

    // studentB starts but doesn't submit — an IN_PROGRESS attempt should hold the gate.
    await startAttempt(f.school.id, f.studentB.id, f.exam.id);
    const stillHidden = await getExamResultForStudent(f.school.id, f.studentA.id, f.exam.id);
    expect(stillHidden?.status).toBe("pending-grading");

    await answerCorrectlyAndSubmit(f.school.id, f.studentB.id, f.exam.id, f.mcq.id);
    const nowVisible = await getExamResultForStudent(f.school.id, f.studentA.id, f.exam.id);
    expect(nowVisible?.status).toBe("visible");
  });

  it("MANUAL_RELEASE: hidden even though grading is done, until a teacher explicitly releases it", async () => {
    const f = await makeResultsFixture({ resultVisibility: "MANUAL_RELEASE" as CBTResultVisibility });
    await answerCorrectlyAndSubmit(f.school.id, f.studentA.id, f.exam.id, f.mcq.id);

    const beforeRelease = await getExamResultForStudent(f.school.id, f.studentA.id, f.exam.id);
    expect(beforeRelease?.status).toBe("pending-release");

    await releaseExamResults(f.school.id, f.exam.id);
    const afterRelease = await getExamResultForStudent(f.school.id, f.studentA.id, f.exam.id);
    expect(afterRelease?.status).toBe("visible");
  });

  it("releaseExamResults refuses to act on an exam that isn't configured for manual release", async () => {
    const f = await makeResultsFixture({ resultVisibility: "IMMEDIATE" as CBTResultVisibility });
    await expect(releaseExamResults(f.school.id, f.exam.id)).rejects.toThrow(/manual result release/i);
  });

  it("correct answers and explanations are only included when the exam opts in", async () => {
    const hidden = await makeResultsFixture({ resultVisibility: "IMMEDIATE" as CBTResultVisibility, showCorrectAnswers: false, showExplanations: false });
    await answerCorrectlyAndSubmit(hidden.school.id, hidden.studentA.id, hidden.exam.id, hidden.mcq.id);
    const hiddenResult = await getExamResultForStudent(hidden.school.id, hidden.studentA.id, hidden.exam.id);
    expect(hiddenResult?.questions?.[0].correctAnswer).toBeUndefined();
    expect(hiddenResult?.questions?.[0].explanation).toBeUndefined();

    const shown = await makeResultsFixture({ resultVisibility: "IMMEDIATE" as CBTResultVisibility, showCorrectAnswers: true, showExplanations: true });
    await answerCorrectlyAndSubmit(shown.school.id, shown.studentA.id, shown.exam.id, shown.mcq.id);
    const shownResult = await getExamResultForStudent(shown.school.id, shown.studentA.id, shown.exam.id);
    expect(shownResult?.questions?.[0].correctAnswer).toEqual(["4"]);
    expect(shownResult?.questions?.[0].explanation).toBe("Basic addition.");
  });

  it("ranking is only computed when the exam enables it", async () => {
    const f = await makeResultsFixture({ resultVisibility: "IMMEDIATE" as CBTResultVisibility, showRanking: true });
    await answerCorrectlyAndSubmit(f.school.id, f.studentA.id, f.exam.id, f.mcq.id);
    // studentB answers wrong -> lower score, so studentA should rank 1st.
    const attemptB = await startAttempt(f.school.id, f.studentB.id, f.exam.id);
    const options = await prisma.cBTQuestionOption.findMany({ where: { questionId: f.mcq.id } });
    const wrong = options.find((o) => !o.isCorrect)!;
    await saveAnswer(f.school.id, f.studentB.id, attemptB.id, f.mcq.id, wrong.id);
    await submitAttempt(f.school.id, f.studentB.id, attemptB.id);

    const result = await getExamResultForStudent(f.school.id, f.studentA.id, f.exam.id);
    expect(result?.rank).toBe(1);
    expect(result?.totalRanked).toBe(2);
  });
});

describe("CBT exam analytics", () => {
  it("computes average/highest/lowest and per-question facility from official attempts only", async () => {
    const f = await makeResultsFixture({ resultVisibility: "IMMEDIATE" as CBTResultVisibility, maxAttempts: 2 });
    await answerCorrectlyAndSubmit(f.school.id, f.studentA.id, f.exam.id, f.mcq.id); // 4/4

    const attemptB = await startAttempt(f.school.id, f.studentB.id, f.exam.id);
    const options = await prisma.cBTQuestionOption.findMany({ where: { questionId: f.mcq.id } });
    const wrong = options.find((o) => !o.isCorrect)!;
    await saveAnswer(f.school.id, f.studentB.id, attemptB.id, f.mcq.id, wrong.id);
    await submitAttempt(f.school.id, f.studentB.id, attemptB.id); // 0/4

    const analytics = await getExamAnalytics(f.school.id, f.exam.id);
    expect(analytics?.gradedCount).toBe(2);
    expect(analytics?.average).toBe(2);
    expect(analytics?.highest).toBe(4);
    expect(analytics?.lowest).toBe(0);
    expect(analytics?.questionStats[0].facility).toBe(50); // 1 of 2 correct
  });

  it("a non-official retake never inflates the analytics", async () => {
    const f = await makeResultsFixture({ resultVisibility: "IMMEDIATE" as CBTResultVisibility, maxAttempts: 2 });
    // First attempt: correct (4/4, becomes official).
    await answerCorrectlyAndSubmit(f.school.id, f.studentA.id, f.exam.id, f.mcq.id);
    // Second attempt: wrong (0/4) — scores lower, must NOT become official or shift the average.
    const attempt2 = await startAttempt(f.school.id, f.studentA.id, f.exam.id);
    const options = await prisma.cBTQuestionOption.findMany({ where: { questionId: f.mcq.id } });
    const wrong = options.find((o) => !o.isCorrect)!;
    await saveAnswer(f.school.id, f.studentA.id, attempt2.id, f.mcq.id, wrong.id);
    await submitAttempt(f.school.id, f.studentA.id, attempt2.id);

    const analytics = await getExamAnalytics(f.school.id, f.exam.id);
    expect(analytics?.gradedCount).toBe(1); // only the official attempt counted
    expect(analytics?.average).toBe(4);
  });
});
