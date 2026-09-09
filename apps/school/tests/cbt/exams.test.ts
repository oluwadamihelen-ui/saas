import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createQuestion } from "@/lib/services/cbt-questions";
import {
  createExam,
  updateExam,
  getExam,
  listExams,
  publishExam,
  unpublishExam,
  archiveExam,
  deleteExam,
  listExamTypes,
  type ExamInput,
} from "@/lib/services/cbt-exams";
import { cleanupTestSchools } from "../helpers/factories";

afterAll(cleanupTestSchools);

let counter = 0;
async function makeFixture() {
  counter += 1;
  const slug = `vitest-cbtexam-${Date.now()}-${counter}`;
  const school = await prisma.school.create({ data: { name: slug, slug, status: "ACTIVE" } });
  const role = await prisma.role.create({ data: { schoolId: school.id, key: "TEACHER", name: "Teacher" } });
  const user = await prisma.user.create({
    data: { schoolId: school.id, roleId: role.id, email: `${slug}@vitest.local`, passwordHash: "x", name: "Test Teacher" },
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
  await prisma.student.createMany({
    data: Array.from({ length: 3 }, (_, i) => ({
      schoolId: school.id,
      classArmId: classArm.id,
      firstName: "Test",
      lastName: `Student${i}`,
      admissionNumber: `${slug}-${i}`,
      dateOfBirth: new Date("2012-01-01"),
      gender: "MALE" as const,
      status: "ACTIVE" as const,
    })),
  });
  const [examType] = await listExamTypes(school.id);

  const q1 = await createQuestion(school.id, user.id, {
    subjectId: subject.id,
    type: "MULTIPLE_CHOICE",
    difficulty: "EASY",
    prompt: "2 + 2?",
    marks: 2,
    options: [{ text: "3", isCorrect: false }, { text: "4", isCorrect: true }],
    tagNames: [],
  });
  const q2 = await createQuestion(school.id, user.id, {
    subjectId: subject.id,
    type: "MULTIPLE_CHOICE",
    difficulty: "EASY",
    prompt: "3 + 3?",
    marks: 3,
    options: [{ text: "6", isCorrect: true }, { text: "5", isCorrect: false }],
    tagNames: [],
  });

  return { school, user, subject, term, classArm, examType, q1, q2 };
}

function baseInput(f: Awaited<ReturnType<typeof makeFixture>>, overrides: Partial<ExamInput> = {}): ExamInput {
  const now = Date.now();
  return {
    title: "Mid-term test",
    examTypeId: f.examType.id,
    subjectId: f.subject.id,
    termId: f.term.id,
    assessmentComponentId: null,
    instructions: null,
    isPractice: false,
    questionSelectionMode: "MANUAL",
    questionIds: [f.q1.id, f.q2.id],
    blueprintTotalQuestions: null,
    blueprintRules: [],
    randomizeQuestionOrder: false,
    randomizeOptionOrder: false,
    negativeMarkingEnabled: false,
    negativeMarkPerWrong: 0,
    startAt: new Date(now + 60 * 60_000),
    endAt: new Date(now + 3 * 60 * 60_000),
    durationMinutes: 60,
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
    classArmIds: [f.classArm.id],
    ...overrides,
  };
}

describe("CBT exam creation validation", () => {
  it("rejects an exam whose end time is before its start time", async () => {
    const f = await makeFixture();
    const now = Date.now();
    await expect(
      createExam(f.school.id, f.user.id, baseInput(f, { startAt: new Date(now + 2 * 3600_000), endAt: new Date(now + 3600_000) }))
    ).rejects.toThrow(/end time/i);
  });

  it("rejects a duration longer than the start/end window", async () => {
    const f = await makeFixture();
    await expect(createExam(f.school.id, f.user.id, baseInput(f, { durationMinutes: 500 }))).rejects.toThrow(/duration/i);
  });

  it("rejects MANUAL mode with zero questions", async () => {
    const f = await makeFixture();
    await expect(createExam(f.school.id, f.user.id, baseInput(f, { questionIds: [] }))).rejects.toThrow(/select at least one question/i);
  });

  it("rejects BLUEPRINT mode whose rule counts don't sum to the total", async () => {
    const f = await makeFixture();
    await expect(
      createExam(
        f.school.id,
        f.user.id,
        baseInput(f, {
          questionSelectionMode: "BLUEPRINT",
          questionIds: [],
          blueprintTotalQuestions: 10,
          blueprintRules: [{ topic: null, difficulty: "EASY", count: 5 }],
        })
      )
    ).rejects.toThrow(/add up/i);
  });

  it("computes total marks as the sum of selected question marks", async () => {
    const f = await makeFixture();
    const exam = await createExam(f.school.id, f.user.id, baseInput(f));
    expect(exam.totalMarks).toBe(5);
    expect(exam.status).toBe("DRAFT");
  });

  it("snapshots active students from the selected class arms as candidates", async () => {
    const f = await makeFixture();
    const exam = await createExam(f.school.id, f.user.id, baseInput(f));
    const full = await getExam(f.school.id, exam.id);
    expect(full?.candidates).toHaveLength(3);
  });
});

describe("CBT exam tenant isolation", () => {
  it("school A can never see school B's exams", async () => {
    const a = await makeFixture();
    const b = await makeFixture();
    const examB = await createExam(b.school.id, b.user.id, baseInput(b));

    expect(await getExam(a.school.id, examB.id)).toBeNull();
    const { exams } = await listExams(a.school.id, {});
    expect(exams.find((e) => e.id === examB.id)).toBeUndefined();
  });
});

describe("CBT exam status lifecycle", () => {
  it("cannot publish without at least one candidate", async () => {
    const f = await makeFixture();
    const exam = await createExam(f.school.id, f.user.id, baseInput(f, { classArmIds: [] }));
    await expect(publishExam(f.school.id, f.user.id, exam.id)).rejects.toThrow(/candidate/i);
  });

  it("publishes a valid draft, and only a draft can be published", async () => {
    const f = await makeFixture();
    const exam = await createExam(f.school.id, f.user.id, baseInput(f));
    const published = await publishExam(f.school.id, f.user.id, exam.id);
    expect(published.status).toBe("PUBLISHED");
    await expect(publishExam(f.school.id, f.user.id, exam.id)).rejects.toThrow(/draft/i);
  });

  it("locks editing once an exam is published", async () => {
    const f = await makeFixture();
    const exam = await createExam(f.school.id, f.user.id, baseInput(f));
    await publishExam(f.school.id, f.user.id, exam.id);
    await expect(updateExam(f.school.id, exam.id, baseInput(f))).rejects.toThrow(/draft/i);
  });

  it("unpublish returns a not-yet-started exam to DRAFT, editable again", async () => {
    const f = await makeFixture();
    const exam = await createExam(f.school.id, f.user.id, baseInput(f));
    await publishExam(f.school.id, f.user.id, exam.id);
    const back = await unpublishExam(f.school.id, exam.id);
    expect(back.status).toBe("DRAFT");
    await expect(updateExam(f.school.id, exam.id, baseInput(f, { title: "Renamed" }))).resolves.toMatchObject({ title: "Renamed" });
  });

  it("cannot unpublish an exam that has already started", async () => {
    const f = await makeFixture();
    const now = Date.now();
    const exam = await createExam(
      f.school.id,
      f.user.id,
      baseInput(f, { startAt: new Date(now - 5000), endAt: new Date(now + 3600_000), durationMinutes: 30 })
    );
    await publishExam(f.school.id, f.user.id, exam.id);
    await expect(unpublishExam(f.school.id, exam.id)).rejects.toThrow(/already started/i);
  });

  it("lazily reconciles PUBLISHED -> LIVE -> ENDED as time passes, on read", async () => {
    const f = await makeFixture();
    const now = Date.now();
    // Publish while still valid (endAt in the future), then fast-forward
    // by rewriting the timestamps directly — simulating time passing
    // without a real sleep — and confirm each read-time transition.
    const exam = await createExam(
      f.school.id,
      f.user.id,
      baseInput(f, { startAt: new Date(now - 3600_000), endAt: new Date(now + 3600_000), durationMinutes: 30 })
    );
    await publishExam(f.school.id, f.user.id, exam.id);

    const live = await getExam(f.school.id, exam.id);
    expect(live?.status).toBe("LIVE");

    await prisma.cBTExam.update({ where: { id: exam.id }, data: { endAt: new Date(now - 1000) } });
    const ended = await getExam(f.school.id, exam.id);
    expect(ended?.status).toBe("ENDED");
  });

  it("cannot archive a LIVE exam but can archive a DRAFT one", async () => {
    const f = await makeFixture();
    const now = Date.now();
    const liveExam = await createExam(
      f.school.id,
      f.user.id,
      baseInput(f, { startAt: new Date(now - 1000), endAt: new Date(now + 3600_000), durationMinutes: 30 })
    );
    await publishExam(f.school.id, f.user.id, liveExam.id);
    await getExam(f.school.id, liveExam.id); // triggers reconcile to LIVE
    await expect(archiveExam(f.school.id, liveExam.id)).rejects.toThrow(/live/i);

    const draftExam = await createExam(f.school.id, f.user.id, baseInput(f));
    const archived = await archiveExam(f.school.id, draftExam.id);
    expect(archived.status).toBe("ARCHIVED");
  });

  it("only a draft exam can be deleted", async () => {
    const f = await makeFixture();
    const exam = await createExam(f.school.id, f.user.id, baseInput(f));
    await publishExam(f.school.id, f.user.id, exam.id);
    await expect(deleteExam(f.school.id, exam.id)).rejects.toThrow(/draft/i);

    const draftExam = await createExam(f.school.id, f.user.id, baseInput(f));
    await deleteExam(f.school.id, draftExam.id);
    expect(await prisma.cBTExam.findUnique({ where: { id: draftExam.id } })).toBeNull();
  });
});
