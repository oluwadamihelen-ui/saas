import { describe, it, expect, afterAll, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { createExam, publishExam, listExamTypes } from "@/lib/services/cbt-exams";
import { approveQuestion, deleteQuestion, createQuestion } from "@/lib/services/cbt-questions";
import { startAttempt, saveAnswer, submitAttempt } from "@/lib/services/cbt-attempts";
import { cleanupTestSchools, attachCbtSubscription } from "../helpers/factories";
import type { ExamInput } from "@/lib/services/cbt-exams";
import type { AiProvider } from "@/lib/ai/types";

const mockGetAiProvider = vi.fn<() => AiProvider | null>();
vi.mock("@/lib/ai/providers/registry", () => ({
  getAiProvider: () => mockGetAiProvider(),
}));

// Imported AFTER the mock so cbt-ai.ts picks up the mocked registry.
const {
  generateQuestionsWithAI,
  generateExamInsights,
  generateRevisionPlan,
  suggestGrade,
} = await import("@/lib/services/cbt-ai");

function mockProvider(text: string): AiProvider {
  return { name: "mock", generate: vi.fn().mockResolvedValue({ type: "text", text }) };
}

afterAll(cleanupTestSchools);
beforeEach(() => mockGetAiProvider.mockReset());

let counter = 0;
async function makeFixture() {
  counter += 1;
  const slug = `vitest-cbtai-${Date.now()}-${counter}`;
  const school = await prisma.school.create({ data: { name: slug, slug, status: "ACTIVE" } });
  await attachCbtSubscription(school.id);
  const role = await prisma.role.create({ data: { schoolId: school.id, key: "TEACHER", name: "Teacher" } });
  const teacher = await prisma.user.create({
    data: { schoolId: school.id, roleId: role.id, email: `${slug}-t@vitest.local`, passwordHash: "x", name: "Teacher" },
  });
  const subject = await prisma.subject.create({ data: { schoolId: school.id, name: "Mathematics", code: "MTH" } });
  return { school, teacher, subject };
}

describe("AI question generation", () => {
  it("throws a clear error when no AI provider is configured", async () => {
    mockGetAiProvider.mockReturnValue(null);
    const f = await makeFixture();
    await expect(
      generateQuestionsWithAI(f.school.id, f.teacher.id, { subjectId: f.subject.id, type: "MULTIPLE_CHOICE", topic: "Fractions", difficulty: "EASY", count: 1 })
    ).rejects.toThrow(/configured/i);
  });

  it("creates AI_PENDING_REVIEW / AI_GENERATED questions from a valid response — never APPROVED", async () => {
    const f = await makeFixture();
    mockGetAiProvider.mockReturnValue(
      mockProvider(
        JSON.stringify({
          questions: [
            {
              prompt: "What is 1/2 + 1/4?",
              marks: 2,
              explanation: "Common denominator is 4.",
              options: [
                { text: "3/4", isCorrect: true },
                { text: "1/2", isCorrect: false },
              ],
            },
          ],
        })
      )
    );

    const result = await generateQuestionsWithAI(f.school.id, f.teacher.id, {
      subjectId: f.subject.id,
      type: "MULTIPLE_CHOICE",
      topic: "Fractions",
      difficulty: "EASY",
      count: 1,
    });
    expect(result.created).toBe(1);
    expect(result.skipped).toHaveLength(0);

    const question = await prisma.cBTQuestion.findFirstOrThrow({ where: { schoolId: f.school.id } });
    expect(question.status).toBe("AI_PENDING_REVIEW");
    expect(question.source).toBe("AI_GENERATED");
    expect(question.approvedById).toBeNull();
  });

  it("skips an individually invalid draft (e.g. two correct options) without discarding the valid ones", async () => {
    const f = await makeFixture();
    mockGetAiProvider.mockReturnValue(
      mockProvider(
        JSON.stringify({
          questions: [
            { prompt: "Valid one", marks: 1, options: [{ text: "A", isCorrect: true }, { text: "B", isCorrect: false }] },
            { prompt: "Bad one — two correct", marks: 1, options: [{ text: "A", isCorrect: true }, { text: "B", isCorrect: true }] },
          ],
        })
      )
    );

    const result = await generateQuestionsWithAI(f.school.id, f.teacher.id, {
      subjectId: f.subject.id,
      type: "MULTIPLE_CHOICE",
      topic: "Numbers",
      difficulty: "EASY",
      count: 2,
    });
    expect(result.created).toBe(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toMatch(/exactly one correct/i);
  });

  it("throws a clear error when the AI response isn't valid JSON", async () => {
    const f = await makeFixture();
    mockGetAiProvider.mockReturnValue(mockProvider("Sorry, I can't help with that."));
    await expect(
      generateQuestionsWithAI(f.school.id, f.teacher.id, { subjectId: f.subject.id, type: "ESSAY", topic: "History", difficulty: "MEDIUM", count: 1 })
    ).rejects.toThrow(/valid JSON/i);
  });

  it("strips a markdown code fence the model wrapped the JSON in", async () => {
    const f = await makeFixture();
    mockGetAiProvider.mockReturnValue(
      mockProvider('```json\n{"questions":[{"prompt":"Explain gravity","marks":5,"rubric":"Mentions mass and attraction."}]}\n```')
    );
    const result = await generateQuestionsWithAI(f.school.id, f.teacher.id, { subjectId: f.subject.id, type: "ESSAY", topic: "Physics", difficulty: "MEDIUM", count: 1 });
    expect(result.created).toBe(1);
  });
});

describe("AI question review — approve/reject never bypasses the human step", () => {
  it("approveQuestion moves AI_PENDING_REVIEW to APPROVED with an attributed approver", async () => {
    const f = await makeFixture();
    const question = await prisma.cBTQuestion.create({
      data: { schoolId: f.school.id, subjectId: f.subject.id, type: "ESSAY", status: "AI_PENDING_REVIEW", source: "AI_GENERATED", difficulty: "EASY", prompt: "AI draft", marks: 5, createdById: f.teacher.id },
    });
    const approved = await approveQuestion(f.school.id, f.teacher.id, question.id);
    expect(approved.status).toBe("APPROVED");
    expect(approved.approvedById).toBe(f.teacher.id);
    expect(approved.approvedAt).not.toBeNull();
  });

  it("approveQuestion refuses to act on a question that isn't AI_PENDING_REVIEW", async () => {
    const f = await makeFixture();
    const question = await createQuestion(f.school.id, f.teacher.id, {
      subjectId: f.subject.id,
      type: "ESSAY",
      difficulty: "EASY",
      prompt: "Manually authored",
      marks: 5,
      options: [],
      tagNames: [],
    });
    await expect(approveQuestion(f.school.id, f.teacher.id, question.id)).rejects.toThrow(/pending review/i);
  });

  it("a rejected AI-pending question can be permanently deleted, same as a draft", async () => {
    const f = await makeFixture();
    const question = await prisma.cBTQuestion.create({
      data: { schoolId: f.school.id, subjectId: f.subject.id, type: "ESSAY", status: "AI_PENDING_REVIEW", source: "AI_GENERATED", difficulty: "EASY", prompt: "Bad draft", marks: 5, createdById: f.teacher.id },
    });
    await deleteQuestion(f.school.id, question.id);
    expect(await prisma.cBTQuestion.findUnique({ where: { id: question.id } })).toBeNull();
  });
});

describe("AI exam insights and revision plans", () => {
  it("generateExamInsights sends only aggregate stats, never a student's name", async () => {
    const f = await makeFixture();
    const session = await prisma.academicSession.create({ data: { schoolId: f.school.id, name: "S", startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true } });
    const term = await prisma.term.create({ data: { schoolId: f.school.id, academicSessionId: session.id, name: "T1", startDate: new Date("2025-09-01"), endDate: new Date("2025-12-15"), isCurrent: true } });
    const classGroup = await prisma.classGroup.create({ data: { schoolId: f.school.id, name: "JSS2", order: 0 } });
    const classArm = await prisma.classArm.create({ data: { schoolId: f.school.id, classGroupId: classGroup.id, name: "A" } });
    const studentRole = await prisma.role.create({ data: { schoolId: f.school.id, key: "STUDENT", name: "Student" } });
    const studentUser = await prisma.user.create({ data: { schoolId: f.school.id, roleId: studentRole.id, email: `insights-${Date.now()}@vitest.local`, passwordHash: "x", name: "Very Unique Student Name" } });
    const student = await prisma.student.create({
      data: { schoolId: f.school.id, classArmId: classArm.id, userId: studentUser.id, firstName: "Very Unique", lastName: "Student Name", admissionNumber: `insights-${Date.now()}`, dateOfBirth: new Date("2012-01-01"), gender: "MALE", status: "ACTIVE" },
    });
    const [examType] = await listExamTypes(f.school.id);
    const mcq = await createQuestion(f.school.id, f.teacher.id, { subjectId: f.subject.id, type: "MULTIPLE_CHOICE", difficulty: "EASY", prompt: "2+2?", marks: 4, options: [{ text: "3", isCorrect: false }, { text: "4", isCorrect: true }], tagNames: [] });
    const now = Date.now();
    const input: ExamInput = {
      title: "Insights exam", examTypeId: examType.id, subjectId: f.subject.id, termId: term.id, assessmentComponentId: null, instructions: null, isPractice: false,
      questionSelectionMode: "MANUAL", questionIds: [mcq.id], blueprintTotalQuestions: null, blueprintRules: [], randomizeQuestionOrder: false, randomizeOptionOrder: false,
      negativeMarkingEnabled: false, negativeMarkPerWrong: 0, startAt: new Date(now - 60_000), endAt: new Date(now + 3600_000), durationMinutes: 30,
      requireFullscreen: false, detectTabSwitch: true, restrictCopyPaste: false, restrictRightClick: false, maxAttempts: 1, autoSubmitOnExpiry: true, desktopOnly: false,
      resultVisibility: "IMMEDIATE", showCorrectAnswers: false, showExplanations: false, showRanking: false, classArmIds: [classArm.id],
    };
    const exam = await createExam(f.school.id, f.teacher.id, input);
    await publishExam(f.school.id, f.teacher.id, exam.id);
    const attempt = await startAttempt(f.school.id, student.id, exam.id);
    const options = await prisma.cBTQuestionOption.findMany({ where: { questionId: mcq.id } });
    await saveAnswer(f.school.id, student.id, attempt.id, mcq.id, options.find((o) => o.isCorrect)!.id);
    await submitAttempt(f.school.id, student.id, attempt.id);

    const provider = mockProvider("The class did well overall.");
    mockGetAiProvider.mockReturnValue(provider);
    await generateExamInsights(f.school.id, exam.id);

    const sentPayload = (provider.generate as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const sentText = JSON.stringify(sentPayload);
    expect(sentText).not.toContain("Very Unique");
    expect(sentText).not.toContain(student.id);
  });

  it("generateRevisionPlan refuses to run before the student's own result is visible", async () => {
    const f = await makeFixture();
    mockGetAiProvider.mockReturnValue(mockProvider("{}"));
    await expect(generateRevisionPlan(f.school.id, "no-such-student", "no-such-exam")).rejects.toThrow(/isn't available/i);
  });
});

describe("AI grading suggestion — advisory only", () => {
  it("clamps an out-of-range suggested mark into [0, maxMarks]", async () => {
    const f = await makeFixture();
    const question = await createQuestion(f.school.id, f.teacher.id, { subjectId: f.subject.id, type: "ESSAY", difficulty: "MEDIUM", prompt: "Explain X", marks: 5, options: [], tagNames: [] });
    // Simulate an existing attempt/answer directly (bypassing the full exam flow, since only the answer row matters here).
    const session = await prisma.academicSession.create({ data: { schoolId: f.school.id, name: "S", startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true } });
    const term = await prisma.term.create({ data: { schoolId: f.school.id, academicSessionId: session.id, name: "T1", startDate: new Date("2025-09-01"), endDate: new Date("2025-12-15"), isCurrent: true } });
    const classGroup = await prisma.classGroup.create({ data: { schoolId: f.school.id, name: "JSS2", order: 0 } });
    const classArm = await prisma.classArm.create({ data: { schoolId: f.school.id, classGroupId: classGroup.id, name: "A" } });
    const student = await prisma.student.create({ data: { schoolId: f.school.id, classArmId: classArm.id, firstName: "S", lastName: "One", admissionNumber: `grade-${Date.now()}`, dateOfBirth: new Date("2012-01-01"), gender: "MALE", status: "ACTIVE" } });
    const [examType] = await listExamTypes(f.school.id);
    const now = Date.now();
    const input: ExamInput = {
      title: "Grade exam", examTypeId: examType.id, subjectId: f.subject.id, termId: term.id, assessmentComponentId: null, instructions: null, isPractice: false,
      questionSelectionMode: "MANUAL", questionIds: [question.id], blueprintTotalQuestions: null, blueprintRules: [], randomizeQuestionOrder: false, randomizeOptionOrder: false,
      negativeMarkingEnabled: false, negativeMarkPerWrong: 0, startAt: new Date(now - 60_000), endAt: new Date(now + 3600_000), durationMinutes: 30,
      requireFullscreen: false, detectTabSwitch: true, restrictCopyPaste: false, restrictRightClick: false, maxAttempts: 1, autoSubmitOnExpiry: true, desktopOnly: false,
      resultVisibility: "IMMEDIATE", showCorrectAnswers: false, showExplanations: false, showRanking: false, classArmIds: [classArm.id],
    };
    const exam = await createExam(f.school.id, f.teacher.id, input);
    await publishExam(f.school.id, f.teacher.id, exam.id);
    const attempt = await startAttempt(f.school.id, student.id, exam.id);
    await saveAnswer(f.school.id, student.id, attempt.id, question.id, "My essay answer.");
    const answer = await prisma.cBTAnswer.findUniqueOrThrow({ where: { attemptId_questionId: { attemptId: attempt.id, questionId: question.id } } });

    mockGetAiProvider.mockReturnValue(mockProvider(JSON.stringify({ suggestedMarks: 999, feedback: "Great answer!" })));
    const suggestion = await suggestGrade(f.school.id, answer.id);
    expect(suggestion.suggestedMarks).toBe(5); // clamped to maxMarks
  });
});
