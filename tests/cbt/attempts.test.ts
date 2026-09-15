import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createQuestion } from "@/lib/services/cbt-questions";
import { createExam, publishExam, listExamTypes } from "@/lib/services/cbt-exams";
import { startAttempt, getAttemptForTaking, saveAnswer, submitAttempt } from "@/lib/services/cbt-attempts";
import { cleanupTestSchools, attachCbtSubscription } from "../helpers/factories";
import type { ExamInput } from "@/lib/services/cbt-exams";

afterAll(cleanupTestSchools);

let counter = 0;

/// Builds a school with one LIVE exam (already published, window covering
/// "now") and one enrolled candidate student, ready to start an attempt.
/// `extraTimeMinutes` and `maxAttempts` are exposed so tests can exercise
/// the server-authoritative accommodation and attempt-limit paths.
async function makeLiveExamFixture(opts: { extraTimeMinutes?: number; maxAttempts?: number; durationMinutes?: number } = {}) {
  counter += 1;
  const slug = `vitest-cbtattempt-${Date.now()}-${counter}`;
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
  const [examType] = await listExamTypes(school.id);

  const q1 = await createQuestion(school.id, teacher.id, {
    subjectId: subject.id,
    type: "MULTIPLE_CHOICE",
    difficulty: "EASY",
    prompt: "2 + 2?",
    marks: 2,
    options: [{ text: "3", isCorrect: false }, { text: "4", isCorrect: true }],
    tagNames: [],
  });
  const matching = await createQuestion(school.id, teacher.id, {
    subjectId: subject.id,
    type: "MATCHING",
    difficulty: "EASY",
    prompt: "Match the country to its capital",
    marks: 4,
    options: [
      { text: "Nigeria", matchText: "Abuja", isCorrect: false },
      { text: "France", matchText: "Paris", isCorrect: false },
    ],
    tagNames: [],
  });

  const now = Date.now();
  const input: ExamInput = {
    title: "Live exam",
    examTypeId: examType.id,
    subjectId: subject.id,
    termId: term.id,
    assessmentComponentId: null,
    instructions: null,
    isPractice: false,
    questionSelectionMode: "MANUAL",
    questionIds: [q1.id, matching.id],
    blueprintTotalQuestions: null,
    blueprintRules: [],
    randomizeQuestionOrder: false,
    randomizeOptionOrder: false,
    negativeMarkingEnabled: false,
    negativeMarkPerWrong: 0,
    startAt: new Date(now - 60_000),
    endAt: new Date(now + 3600_000),
    durationMinutes: opts.durationMinutes ?? 30,
    requireFullscreen: false,
    detectTabSwitch: true,
    restrictCopyPaste: false,
    restrictRightClick: false,
    maxAttempts: opts.maxAttempts ?? 1,
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
  // publishExam requires endAt in the future; startAt already in the past
  // reconciles the exam to LIVE the moment anything reads it (getExamForCandidate/startAttempt).

  if (opts.extraTimeMinutes) {
    await prisma.cBTExamCandidate.updateMany({ where: { examId: exam.id, studentId: student.id }, data: { extraTimeMinutes: opts.extraTimeMinutes } });
  }

  return { school, teacher, student, subject, exam, q1, matching };
}

describe("CBT attempt start — server-authoritative timing and attempt limits", () => {
  it("rejects starting an attempt for a student who isn't a candidate", async () => {
    const f = await makeLiveExamFixture();
    await expect(startAttempt(f.school.id, "not-a-real-student-id", f.exam.id)).rejects.toThrow(/not assigned/i);
  });

  it("computes deadlineAt from exam duration plus only the server-stored extraTimeMinutes", async () => {
    const f = await makeLiveExamFixture({ extraTimeMinutes: 15, durationMinutes: 30 });
    const before = Date.now();
    const attempt = await startAttempt(f.school.id, f.student.id, f.exam.id);
    const expectedMs = 45 * 60_000; // 30 + 15
    const actualMs = attempt.deadlineAt.getTime() - before;
    expect(Math.abs(actualMs - expectedMs)).toBeLessThan(5000);
  });

  it("re-starting while already IN_PROGRESS resumes the same attempt instead of creating a second one", async () => {
    const f = await makeLiveExamFixture();
    const first = await startAttempt(f.school.id, f.student.id, f.exam.id);
    const second = await startAttempt(f.school.id, f.student.id, f.exam.id);
    expect(second.id).toBe(first.id);
    const count = await prisma.cBTAttempt.count({ where: { examId: f.exam.id, studentId: f.student.id } });
    expect(count).toBe(1);
  });

  it("blocks a new attempt once maxAttempts is used up", async () => {
    const f = await makeLiveExamFixture({ maxAttempts: 1 });
    const attempt = await startAttempt(f.school.id, f.student.id, f.exam.id);
    await submitAttempt(f.school.id, f.student.id, attempt.id);
    await expect(startAttempt(f.school.id, f.student.id, f.exam.id)).rejects.toThrow(/used all your attempts/i);
  });

  it("snapshots the exam's questions into CBTAttemptQuestion rows at start", async () => {
    const f = await makeLiveExamFixture();
    const attempt = await startAttempt(f.school.id, f.student.id, f.exam.id);
    const rows = await prisma.cBTAttemptQuestion.findMany({ where: { attemptId: attempt.id } });
    expect(rows).toHaveLength(2);
  });
});

describe("CBT attempt-taking — answer keys are never exposed to the student", () => {
  it("the attempt payload structurally excludes isCorrect, matchText pairing, acceptedAnswers and rubric", async () => {
    const f = await makeLiveExamFixture();
    const attempt = await startAttempt(f.school.id, f.student.id, f.exam.id);
    const taking = await getAttemptForTaking(f.school.id, f.student.id, attempt.id);
    expect(taking).not.toBeNull();

    const serialized = JSON.stringify(taking);
    expect(serialized).not.toContain("isCorrect");
    expect(serialized).not.toContain("acceptedAnswers");
    expect(serialized).not.toContain("rubric");

    const matchingQuestion = taking!.questions.find((q) => q.type === "MATCHING")!;
    expect(matchingQuestion.options.every((o) => Object.keys(o).sort().join(",") === "id,text")).toBe(true);
    expect(matchingQuestion.matchPool!.every((p) => Object.keys(p).sort().join(",") === "index,text")).toBe(true);
    // The left-side "Nigeria"/"France" options must never carry their own
    // matchText ("Abuja"/"Paris") — only the shuffled, unlabeled pool does.
    expect(serialized).not.toMatch(/"text":"Nigeria".*"matchText"/);
  });
});

describe("CBT attempt submission — idempotent and server-clock enforced", () => {
  it("submit is idempotent: a second call after submission is a harmless no-op", async () => {
    const f = await makeLiveExamFixture();
    const attempt = await startAttempt(f.school.id, f.student.id, f.exam.id);
    const first = await submitAttempt(f.school.id, f.student.id, attempt.id);
    const second = await submitAttempt(f.school.id, f.student.id, attempt.id);
    // The fixture's questions are all auto-gradable (Phase 5), so
    // submission immediately finalizes grading in the same call — GRADED
    // is the resting state here, not the transient SUBMITTED.
    expect(first.status).toBe("GRADED");
    expect(second.status).toBe("GRADED");
    expect(second.submittedAt?.getTime()).toBe(first.submittedAt?.getTime());
  });

  it("saveAnswer is rejected once the server-side deadline has passed, even if called directly", async () => {
    const f = await makeLiveExamFixture();
    const attempt = await startAttempt(f.school.id, f.student.id, f.exam.id);
    await prisma.cBTAttempt.update({ where: { id: attempt.id }, data: { deadlineAt: new Date(Date.now() - 1000) } });

    await expect(saveAnswer(f.school.id, f.student.id, attempt.id, f.q1.id, "4")).rejects.toThrow(/time is up/i);
    const reconciled = await prisma.cBTAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    // Same as above: the lazy expiry reconcile auto-submits AND grades in
    // one pass, so a fully auto-gradable attempt lands on GRADED.
    expect(reconciled.status).toBe("GRADED");
  });

  it("saveAnswer persists a response that getAttemptForTaking later returns as savedResponse", async () => {
    const f = await makeLiveExamFixture();
    const attempt = await startAttempt(f.school.id, f.student.id, f.exam.id);
    await saveAnswer(f.school.id, f.student.id, attempt.id, f.q1.id, "some-option-id");
    const taking = await getAttemptForTaking(f.school.id, f.student.id, attempt.id);
    const q = taking!.questions.find((q) => q.id === f.q1.id)!;
    expect(q.savedResponse).toBe("some-option-id");
  });
});

describe("CBT attempt cross-student isolation", () => {
  it("student B cannot read or write to student A's attempt", async () => {
    const f = await makeLiveExamFixture();
    const attempt = await startAttempt(f.school.id, f.student.id, f.exam.id);

    const roleB = await prisma.role.create({ data: { schoolId: f.school.id, key: "STUDENT_B", name: "Student" } });
    const userB = await prisma.user.create({
      data: { schoolId: f.school.id, roleId: roleB.id, email: `intruder-${Date.now()}@vitest.local`, passwordHash: "x", name: "Intruder" },
    });
    const studentB = await prisma.student.create({
      data: {
        schoolId: f.school.id,
        userId: userB.id,
        firstName: "Intruder",
        lastName: "B",
        admissionNumber: `intruder-${Date.now()}`,
        dateOfBirth: new Date("2012-01-01"),
        gender: "FEMALE",
        status: "ACTIVE",
      },
    });

    expect(await getAttemptForTaking(f.school.id, studentB.id, attempt.id)).toBeNull();
    await expect(saveAnswer(f.school.id, studentB.id, attempt.id, f.q1.id, "x")).rejects.toThrow(/not found/i);
    await expect(submitAttempt(f.school.id, studentB.id, attempt.id)).rejects.toThrow(/not found/i);
  });
});

describe("CBT auto-submit on expiry", () => {
  it("a read past deadlineAt auto-submits the attempt and grades it, exactly once", async () => {
    const f = await makeLiveExamFixture();
    const attempt = await startAttempt(f.school.id, f.student.id, f.exam.id);
    await saveAnswer(f.school.id, f.student.id, attempt.id, f.q1.id, "wrong-answer"); // left ungraded-correct on purpose

    // Force the deadline into the past — same effect as real time passing,
    // without an actual 30-minute wait in a test.
    await prisma.cBTAttempt.update({ where: { id: attempt.id }, data: { deadlineAt: new Date(Date.now() - 1000) } });

    const reconciled = await getAttemptForTaking(f.school.id, f.student.id, attempt.id);
    expect(reconciled?.status).toBe("GRADED"); // both questions are auto-gradable, so grading finalizes immediately

    const finalAttempt = await prisma.cBTAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(finalAttempt.status).toBe("GRADED");
    expect(finalAttempt.submittedAt).not.toBeNull();
    expect(finalAttempt.score).not.toBeNull();

    // A second read after the transition must never re-grade or change submittedAt.
    const submittedAtFirst = finalAttempt.submittedAt;
    await getAttemptForTaking(f.school.id, f.student.id, attempt.id);
    const afterSecondRead = await prisma.cBTAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(afterSecondRead.submittedAt?.getTime()).toBe(submittedAtFirst?.getTime());
  });

  it("saveAnswer and submitAttempt both trigger the same auto-submit reconciliation, not just getAttemptForTaking", async () => {
    const f = await makeLiveExamFixture();
    const attempt = await startAttempt(f.school.id, f.student.id, f.exam.id);
    await prisma.cBTAttempt.update({ where: { id: attempt.id }, data: { deadlineAt: new Date(Date.now() - 1000) } });

    await expect(saveAnswer(f.school.id, f.student.id, attempt.id, f.q1.id, "too-late")).rejects.toThrow(/time is up/i);
    const afterSave = await prisma.cBTAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(afterSave.status).toBe("GRADED");

    // submitAttempt on an already-auto-submitted (now GRADED) attempt is a harmless no-op, not an error.
    await expect(submitAttempt(f.school.id, f.student.id, attempt.id)).resolves.toMatchObject({ status: "GRADED" });
  });
});
