import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createQuestion } from "@/lib/services/cbt-questions";
import { createExam, publishExam, listExamTypes } from "@/lib/services/cbt-exams";
import { startAttempt, saveAnswer, submitAttempt } from "@/lib/services/cbt-attempts";
import { gradeAnswer, listGradingQueue } from "@/lib/services/cbt-grading";
import { cleanupTestSchools, attachCbtSubscription } from "../helpers/factories";
import type { ExamInput } from "@/lib/services/cbt-exams";

afterAll(cleanupTestSchools);

let counter = 0;

/// A school + one LIVE exam covering every auto-gradable type plus an
/// ESSAY, an assessment component to post the official score to, and one
/// enrolled candidate — everything needed to exercise the full grading
/// pipeline end to end.
async function makeGradingFixture(opts: { negativeMarking?: boolean } = {}) {
  counter += 1;
  const slug = `vitest-cbtgrade-${Date.now()}-${counter}`;
  const school = await prisma.school.create({ data: { name: slug, slug, status: "ACTIVE" } });
  await attachCbtSubscription(school.id);
  const role = await prisma.role.create({ data: { schoolId: school.id, key: "TEACHER", name: "Teacher" } });
  const teacher = await prisma.user.create({
    data: { schoolId: school.id, roleId: role.id, email: `${slug}-t@vitest.local`, passwordHash: "x", name: "Teacher" },
  });
  const studentRole = await prisma.role.create({ data: { schoolId: school.id, key: "STUDENT", name: "Student" } });
  const studentUser = await prisma.user.create({
    data: { schoolId: school.id, roleId: studentRole.id, email: `${slug}-s@vitest.local`, passwordHash: "x", name: "Student One" },
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
  const student = await prisma.student.create({
    data: {
      schoolId: school.id,
      classArmId: classArm.id,
      userId: studentUser.id,
      firstName: "Student",
      lastName: "One",
      admissionNumber: `${slug}-adm`,
      dateOfBirth: new Date("2012-01-01"),
      gender: "MALE",
      status: "ACTIVE",
    },
  });
  const component = await prisma.assessmentComponent.create({ data: { schoolId: school.id, name: "CBT Exam", maxScore: 100, order: 0 } });
  const [examType] = await listExamTypes(school.id);

  const mcq = await createQuestion(school.id, teacher.id, {
    subjectId: subject.id,
    type: "MULTIPLE_CHOICE",
    difficulty: "EASY",
    prompt: "2 + 2?",
    marks: 4,
    options: [{ text: "3", isCorrect: false }, { text: "4", isCorrect: true }],
    tagNames: [],
  });
  const multiSelect = await createQuestion(school.id, teacher.id, {
    subjectId: subject.id,
    type: "MULTIPLE_SELECT",
    difficulty: "EASY",
    prompt: "Pick the even numbers",
    marks: 4,
    options: [
      { text: "2", isCorrect: true },
      { text: "3", isCorrect: false },
      { text: "4", isCorrect: true },
    ],
    tagNames: [],
  });
  const shortAnswer = await createQuestion(school.id, teacher.id, {
    subjectId: subject.id,
    type: "SHORT_ANSWER",
    difficulty: "EASY",
    prompt: "Capital of Nigeria?",
    marks: 4,
    options: [],
    tagNames: [],
    acceptedAnswers: ["Abuja"],
  });
  const ordering = await createQuestion(school.id, teacher.id, {
    subjectId: subject.id,
    type: "ORDERING",
    difficulty: "EASY",
    prompt: "Order smallest to largest",
    marks: 4,
    options: [
      { text: "1", isCorrect: false, order: 0 },
      { text: "2", isCorrect: false, order: 1 },
      { text: "3", isCorrect: false, order: 2 },
    ],
    tagNames: [],
  });
  const matching = await createQuestion(school.id, teacher.id, {
    subjectId: subject.id,
    type: "MATCHING",
    difficulty: "EASY",
    prompt: "Match country to capital",
    marks: 4,
    options: [
      { text: "Nigeria", matchText: "Abuja", isCorrect: false },
      { text: "France", matchText: "Paris", isCorrect: false },
    ],
    tagNames: [],
  });
  const essay = await createQuestion(school.id, teacher.id, {
    subjectId: subject.id,
    type: "ESSAY",
    difficulty: "MEDIUM",
    prompt: "Explain photosynthesis.",
    marks: 10,
    options: [],
    tagNames: [],
  });

  const now = Date.now();
  const input: ExamInput = {
    title: "Full grading exam",
    examTypeId: examType.id,
    subjectId: subject.id,
    termId: term.id,
    assessmentComponentId: component.id,
    instructions: null,
    isPractice: false,
    questionSelectionMode: "MANUAL",
    questionIds: [mcq.id, multiSelect.id, shortAnswer.id, ordering.id, matching.id, essay.id],
    blueprintTotalQuestions: null,
    blueprintRules: [],
    randomizeQuestionOrder: false,
    randomizeOptionOrder: false,
    negativeMarkingEnabled: opts.negativeMarking ?? false,
    negativeMarkPerWrong: 1,
    startAt: new Date(now - 60_000),
    endAt: new Date(now + 3600_000),
    durationMinutes: 30,
    requireFullscreen: false,
    detectTabSwitch: true,
    restrictCopyPaste: false,
    restrictRightClick: false,
    maxAttempts: 3,
    autoSubmitOnExpiry: true,
    desktopOnly: false,
    resultVisibility: "AFTER_GRADING",
    showCorrectAnswers: false,
    showExplanations: false,
    showRanking: false,
    classArmIds: [classArm.id],
  };
  const exam = await createExam(school.id, teacher.id, input);
  await publishExam(school.id, teacher.id, exam.id);

  return { school, teacher, student, subject, term, component, exam, mcq, multiSelect, shortAnswer, ordering, matching, essay };
}

describe("CBT auto-grading — per-type correctness", () => {
  it("grades every objective type correctly and leaves the essay pending manual review", async () => {
    const f = await makeGradingFixture();
    const attempt = await startAttempt(f.school.id, f.student.id, f.exam.id);

    const orderingOptions = await prisma.cBTQuestionOption.findMany({ where: { questionId: f.ordering.id }, orderBy: { order: "asc" } });
    const matchingOptions = await prisma.cBTQuestionOption.findMany({ where: { questionId: f.matching.id }, orderBy: { order: "asc" } });
    const nigeria = matchingOptions.find((o) => o.text === "Nigeria")!;
    const france = matchingOptions.find((o) => o.text === "France")!;
    const attemptQuestion = await prisma.cBTAttemptQuestion.findUniqueOrThrow({
      where: { attemptId_questionId: { attemptId: attempt.id, questionId: f.matching.id } },
    });
    const poolOrder = attemptQuestion.optionOrder as string[];

    const mcqOptions = await prisma.cBTQuestionOption.findMany({ where: { questionId: f.mcq.id } });
    const correctMcq = mcqOptions.find((o) => o.isCorrect)!;
    const multiOptions = await prisma.cBTQuestionOption.findMany({ where: { questionId: f.multiSelect.id } });
    const correctMulti = multiOptions.filter((o) => o.isCorrect).map((o) => o.id);

    await saveAnswer(f.school.id, f.student.id, attempt.id, f.mcq.id, correctMcq.id);
    await saveAnswer(f.school.id, f.student.id, attempt.id, f.multiSelect.id, correctMulti);
    await saveAnswer(f.school.id, f.student.id, attempt.id, f.shortAnswer.id, "abuja"); // case-insensitive
    await saveAnswer(f.school.id, f.student.id, attempt.id, f.ordering.id, orderingOptions.map((o) => o.id));
    await saveAnswer(f.school.id, f.student.id, attempt.id, f.matching.id, {
      [nigeria.id]: poolOrder.indexOf(nigeria.id),
      [france.id]: poolOrder.indexOf(france.id),
    });
    await saveAnswer(f.school.id, f.student.id, attempt.id, f.essay.id, "Plants use sunlight to make food.");

    const graded = await submitAttempt(f.school.id, f.student.id, attempt.id);
    expect(graded.status).toBe("SUBMITTED"); // held back — the essay still needs a human

    const answers = await prisma.cBTAnswer.findMany({ where: { attemptId: attempt.id } });
    const byQuestion = new Map(answers.map((a) => [a.questionId, a]));
    expect(byQuestion.get(f.mcq.id)?.marksAwarded).toBe(4);
    expect(byQuestion.get(f.multiSelect.id)?.marksAwarded).toBe(4);
    expect(byQuestion.get(f.shortAnswer.id)?.marksAwarded).toBe(4);
    expect(byQuestion.get(f.ordering.id)?.marksAwarded).toBe(4);
    expect(byQuestion.get(f.matching.id)?.marksAwarded).toBe(4);
    expect(byQuestion.get(f.essay.id)?.gradingStatus).toBe("NEEDS_MANUAL_GRADING");
  });

  it("MULTIPLE_SELECT is all-or-nothing: a partially correct selection scores zero", async () => {
    const f = await makeGradingFixture();
    const attempt = await startAttempt(f.school.id, f.student.id, f.exam.id);
    const options = await prisma.cBTQuestionOption.findMany({ where: { questionId: f.multiSelect.id } });
    const correctOne = options.find((o) => o.isCorrect)!;
    const wrongOne = options.find((o) => !o.isCorrect)!;

    await saveAnswer(f.school.id, f.student.id, attempt.id, f.multiSelect.id, [correctOne.id, wrongOne.id]);
    const questionsToClear = [f.mcq.id, f.shortAnswer.id, f.ordering.id, f.matching.id, f.essay.id];
    for (const qId of questionsToClear) await saveAnswer(f.school.id, f.student.id, attempt.id, qId, "");

    await submitAttempt(f.school.id, f.student.id, attempt.id);
    const answer = await prisma.cBTAnswer.findUniqueOrThrow({ where: { attemptId_questionId: { attemptId: attempt.id, questionId: f.multiSelect.id } } });
    expect(answer.isCorrect).toBe(false);
    expect(answer.marksAwarded).toBe(0);
  });

  it("MATCHING gives proportional credit for partially correct pairing", async () => {
    const f = await makeGradingFixture();
    const attempt = await startAttempt(f.school.id, f.student.id, f.exam.id);
    const matchingOptions = await prisma.cBTQuestionOption.findMany({ where: { questionId: f.matching.id }, orderBy: { order: "asc" } });
    const nigeria = matchingOptions.find((o) => o.text === "Nigeria")!;
    const france = matchingOptions.find((o) => o.text === "France")!;
    const attemptQuestion = await prisma.cBTAttemptQuestion.findUniqueOrThrow({
      where: { attemptId_questionId: { attemptId: attempt.id, questionId: f.matching.id } },
    });
    const poolOrder = attemptQuestion.optionOrder as string[];

    // Only Nigeria matched correctly; France paired with Nigeria's slot (wrong).
    await saveAnswer(f.school.id, f.student.id, attempt.id, f.matching.id, {
      [nigeria.id]: poolOrder.indexOf(nigeria.id),
      [france.id]: poolOrder.indexOf(nigeria.id),
    });

    await submitAttempt(f.school.id, f.student.id, attempt.id);
    const answer = await prisma.cBTAnswer.findUniqueOrThrow({ where: { attemptId_questionId: { attemptId: attempt.id, questionId: f.matching.id } } });
    expect(answer.marksAwarded).toBe(2); // 1 of 2 pairs correct, 4 marks -> 2
  });
});

describe("CBT negative marking", () => {
  it("deducts only for an answered-and-wrong objective question, never for a blank one", async () => {
    const f = await makeGradingFixture({ negativeMarking: true });
    const attempt = await startAttempt(f.school.id, f.student.id, f.exam.id);
    const mcqOptions = await prisma.cBTQuestionOption.findMany({ where: { questionId: f.mcq.id } });
    const wrongOption = mcqOptions.find((o) => !o.isCorrect)!;

    await saveAnswer(f.school.id, f.student.id, attempt.id, f.mcq.id, wrongOption.id); // wrong, answered
    // shortAnswer left blank entirely (no saveAnswer call)

    await submitAttempt(f.school.id, f.student.id, attempt.id);
    const mcqAnswer = await prisma.cBTAnswer.findUniqueOrThrow({ where: { attemptId_questionId: { attemptId: attempt.id, questionId: f.mcq.id } } });
    expect(mcqAnswer.marksAwarded).toBe(-1);

    const shortAnswerRow = await prisma.cBTAnswer.findUnique({ where: { attemptId_questionId: { attemptId: attempt.id, questionId: f.shortAnswer.id } } });
    expect(shortAnswerRow?.marksAwarded ?? 0).toBe(0);
  });
});

describe("CBT manual grading queue and finalization", () => {
  it("grading the essay finalizes the attempt, computes the combined score, and writes the gradebook", async () => {
    const f = await makeGradingFixture();
    const attempt = await startAttempt(f.school.id, f.student.id, f.exam.id);
    const mcqOptions = await prisma.cBTQuestionOption.findMany({ where: { questionId: f.mcq.id } });
    const correctMcq = mcqOptions.find((o) => o.isCorrect)!;

    await saveAnswer(f.school.id, f.student.id, attempt.id, f.mcq.id, correctMcq.id); // +4
    await saveAnswer(f.school.id, f.student.id, attempt.id, f.essay.id, "Photosynthesis is...");
    await submitAttempt(f.school.id, f.student.id, attempt.id);

    const queue = await listGradingQueue(f.school.id, { examId: f.exam.id });
    expect(queue).toHaveLength(1);
    expect(queue[0].questionId).toBe(f.essay.id);

    await gradeAnswer(f.school.id, f.teacher.id, queue[0].id, 7, "Good explanation.");

    const finalAttempt = await prisma.cBTAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(finalAttempt.status).toBe("GRADED");
    expect(finalAttempt.score).toBe(11); // 4 (mcq) + 7 (essay); everything else unanswered = 0
    expect(finalAttempt.isOfficialResult).toBe(true);

    const score = await prisma.score.findUnique({
      where: { studentId_subjectId_termId_componentId: { studentId: f.student.id, subjectId: f.subject.id, termId: f.term.id, componentId: f.component.id } },
    });
    expect(score?.value).toBe(11);

    const stillQueued = await listGradingQueue(f.school.id, { examId: f.exam.id });
    expect(stillQueued).toHaveLength(0);
  });

  it("rejects marks outside the question's max", async () => {
    const f = await makeGradingFixture();
    const attempt = await startAttempt(f.school.id, f.student.id, f.exam.id);
    await saveAnswer(f.school.id, f.student.id, attempt.id, f.essay.id, "An answer.");
    await submitAttempt(f.school.id, f.student.id, attempt.id);
    const [item] = await listGradingQueue(f.school.id, { examId: f.exam.id });
    await expect(gradeAnswer(f.school.id, f.teacher.id, item.id, 999, null)).rejects.toThrow(/between 0 and/i);
  });

  it("a higher-scoring retake is promoted to official and updates the gradebook; a lower one doesn't", async () => {
    const f = await makeGradingFixture();
    const mcqOptions = await prisma.cBTQuestionOption.findMany({ where: { questionId: f.mcq.id } });
    const correct = mcqOptions.find((o) => o.isCorrect)!;
    const wrong = mcqOptions.find((o) => !o.isCorrect)!;

    // Attempt 1: wrong MCQ answer, essay graded for 2 marks -> total 2.
    const attempt1 = await startAttempt(f.school.id, f.student.id, f.exam.id);
    await saveAnswer(f.school.id, f.student.id, attempt1.id, f.mcq.id, wrong.id);
    await saveAnswer(f.school.id, f.student.id, attempt1.id, f.essay.id, "weak answer");
    await submitAttempt(f.school.id, f.student.id, attempt1.id);
    const [item1] = await listGradingQueue(f.school.id, { examId: f.exam.id });
    await gradeAnswer(f.school.id, f.teacher.id, item1.id, 2, null);

    let score = await prisma.score.findUniqueOrThrow({
      where: { studentId_subjectId_termId_componentId: { studentId: f.student.id, subjectId: f.subject.id, termId: f.term.id, componentId: f.component.id } },
    });
    expect(score.value).toBe(2);

    // Attempt 2: correct MCQ, essay graded for 1 mark -> total 5, higher -> promoted.
    const attempt2 = await startAttempt(f.school.id, f.student.id, f.exam.id);
    await saveAnswer(f.school.id, f.student.id, attempt2.id, f.mcq.id, correct.id);
    await saveAnswer(f.school.id, f.student.id, attempt2.id, f.essay.id, "better answer");
    await submitAttempt(f.school.id, f.student.id, attempt2.id);
    const [item2] = await listGradingQueue(f.school.id, { examId: f.exam.id });
    await gradeAnswer(f.school.id, f.teacher.id, item2.id, 1, null);

    score = await prisma.score.findUniqueOrThrow({
      where: { studentId_subjectId_termId_componentId: { studentId: f.student.id, subjectId: f.subject.id, termId: f.term.id, componentId: f.component.id } },
    });
    expect(score.value).toBe(5);

    const attempt1After = await prisma.cBTAttempt.findUniqueOrThrow({ where: { id: attempt1.id } });
    const attempt2After = await prisma.cBTAttempt.findUniqueOrThrow({ where: { id: attempt2.id } });
    expect(attempt1After.isOfficialResult).toBe(false);
    expect(attempt2After.isOfficialResult).toBe(true);

    // Attempt 3: scores lower than the current official (5) — must NOT overwrite the gradebook.
    const attempt3 = await startAttempt(f.school.id, f.student.id, f.exam.id);
    await saveAnswer(f.school.id, f.student.id, attempt3.id, f.mcq.id, wrong.id);
    await saveAnswer(f.school.id, f.student.id, attempt3.id, f.essay.id, "meh");
    await submitAttempt(f.school.id, f.student.id, attempt3.id);
    const [item3] = await listGradingQueue(f.school.id, { examId: f.exam.id });
    await gradeAnswer(f.school.id, f.teacher.id, item3.id, 1, null); // total 1, lower than 5

    score = await prisma.score.findUniqueOrThrow({
      where: { studentId_subjectId_termId_componentId: { studentId: f.student.id, subjectId: f.subject.id, termId: f.term.id, componentId: f.component.id } },
    });
    expect(score.value).toBe(5); // unchanged
    const attempt2Final = await prisma.cBTAttempt.findUniqueOrThrow({ where: { id: attempt2.id } });
    expect(attempt2Final.isOfficialResult).toBe(true);
  });
});
