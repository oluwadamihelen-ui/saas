import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createQuestion } from "@/lib/services/cbt-questions";
import { createExam, publishExam, listExamTypes, grantExamExtension } from "@/lib/services/cbt-exams";
import { startAttempt, submitAttempt } from "@/lib/services/cbt-attempts";
import { logSecurityEvent, listSecurityEventsForExam } from "@/lib/services/cbt-security";
import { cleanupTestSchools, attachCbtSubscription } from "../helpers/factories";
import type { ExamInput } from "@/lib/services/cbt-exams";

afterAll(cleanupTestSchools);

let counter = 0;

async function makeSecurityFixture() {
  counter += 1;
  const slug = `vitest-cbtsecurity-${Date.now()}-${counter}`;
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

  const mcq = await createQuestion(school.id, teacher.id, {
    subjectId: subject.id,
    type: "MULTIPLE_CHOICE",
    difficulty: "EASY",
    prompt: "2 + 2?",
    marks: 4,
    options: [{ text: "3", isCorrect: false }, { text: "4", isCorrect: true }],
    tagNames: [],
  });

  const now = Date.now();
  const input: ExamInput = {
    title: "Security exam",
    examTypeId: examType.id,
    subjectId: subject.id,
    termId: term.id,
    assessmentComponentId: null,
    instructions: null,
    isPractice: false,
    questionSelectionMode: "MANUAL",
    questionIds: [mcq.id],
    blueprintTotalQuestions: null,
    blueprintRules: [],
    randomizeQuestionOrder: false,
    randomizeOptionOrder: false,
    negativeMarkingEnabled: false,
    negativeMarkPerWrong: 1,
    startAt: new Date(now - 60_000),
    endAt: new Date(now + 3600_000),
    durationMinutes: 30,
    requireFullscreen: true,
    detectTabSwitch: true,
    restrictCopyPaste: true,
    restrictRightClick: true,
    maxAttempts: 3,
    autoSubmitOnExpiry: true,
    desktopOnly: false,
    resultVisibility: "IMMEDIATE",
    showCorrectAnswers: false,
    showExplanations: false,
    showRanking: false,
    classArmIds: [classArm.id],
  };
  const exam = await createExam(school.id, teacher.id, input);
  await publishExam(school.id, teacher.id, exam.id);

  return { school, teacher, student, exam };
}

describe("CBT security event logging", () => {
  it("logs an event for the attempt's own owning student", async () => {
    const f = await makeSecurityFixture();
    const attempt = await startAttempt(f.school.id, f.student.id, f.exam.id);

    const event = await logSecurityEvent(f.school.id, f.student.id, attempt.id, "TAB_SWITCH");
    expect(event).not.toBeNull();
    expect(event?.type).toBe("TAB_SWITCH");
    expect(event?.attemptId).toBe(attempt.id);
  });

  it("silently no-ops for a student who doesn't own the attempt", async () => {
    const f = await makeSecurityFixture();
    const attempt = await startAttempt(f.school.id, f.student.id, f.exam.id);

    const otherStudentRole = await prisma.role.create({ data: { schoolId: f.school.id, key: "STUDENT2", name: "Student2" } });
    const otherUser = await prisma.user.create({
      data: { schoolId: f.school.id, roleId: otherStudentRole.id, email: `intruder-${Date.now()}@vitest.local`, passwordHash: "x", name: "Intruder" },
    });
    const classArm = await prisma.classArm.findFirstOrThrow({ where: { schoolId: f.school.id } });
    const otherStudent = await prisma.student.create({
      data: {
        schoolId: f.school.id,
        classArmId: classArm.id,
        userId: otherUser.id,
        firstName: "Intruder",
        lastName: "Two",
        admissionNumber: `intruder-${Date.now()}`,
        dateOfBirth: new Date("2012-01-01"),
        gender: "FEMALE",
        status: "ACTIVE",
      },
    });

    const event = await logSecurityEvent(f.school.id, otherStudent.id, attempt.id, "COPY_ATTEMPT");
    expect(event).toBeNull();
    const rows = await prisma.cBTSecurityEvent.findMany({ where: { attemptId: attempt.id } });
    expect(rows).toHaveLength(0);
  });

  it("does not log once the attempt is no longer IN_PROGRESS", async () => {
    const f = await makeSecurityFixture();
    const attempt = await startAttempt(f.school.id, f.student.id, f.exam.id);
    await submitAttempt(f.school.id, f.student.id, attempt.id);

    const event = await logSecurityEvent(f.school.id, f.student.id, attempt.id, "PASTE_ATTEMPT");
    expect(event).toBeNull();
  });

  it("lists events for an exam joined with student info, scoped to the school", async () => {
    const f = await makeSecurityFixture();
    const attempt = await startAttempt(f.school.id, f.student.id, f.exam.id);
    await logSecurityEvent(f.school.id, f.student.id, attempt.id, "FULLSCREEN_EXIT");
    await logSecurityEvent(f.school.id, f.student.id, attempt.id, "RIGHT_CLICK_ATTEMPT");

    const events = await listSecurityEventsForExam(f.school.id, f.exam.id);
    expect(events).toHaveLength(2);
    expect(events[0].attempt.student.admissionNumber).toBe(f.student.admissionNumber);

    const other = await prisma.school.create({ data: { name: `vitest-other-${Date.now()}`, slug: `vitest-other-${Date.now()}`, status: "ACTIVE" } });
    await expect(listSecurityEventsForExam(other.id, f.exam.id)).rejects.toThrow(/not found/i);
  });
});

describe("CBT exam extensions", () => {
  it("sets the candidate's total extra time and records who granted it", async () => {
    const f = await makeSecurityFixture();
    const candidate = await prisma.cBTExamCandidate.findFirstOrThrow({ where: { examId: f.exam.id, studentId: f.student.id } });

    const updated = await grantExamExtension(f.school.id, f.teacher.id, candidate.id, 15, "Assistive technology use");
    expect(updated.extraTimeMinutes).toBe(15);
    expect(updated.extensionReason).toBe("Assistive technology use");
    expect(updated.extensionGrantedById).toBe(f.teacher.id);
  });

  it("shifts the deadline of an in-progress attempt by the delta", async () => {
    const f = await makeSecurityFixture();
    const candidate = await prisma.cBTExamCandidate.findFirstOrThrow({ where: { examId: f.exam.id, studentId: f.student.id } });
    await grantExamExtension(f.school.id, f.teacher.id, candidate.id, 10, null);

    const attempt = await startAttempt(f.school.id, f.student.id, f.exam.id); // starts with the 10 extra minutes baked in
    const originalDeadline = attempt.deadlineAt.getTime();

    await grantExamExtension(f.school.id, f.teacher.id, candidate.id, 25, "Extra time granted mid-sitting");
    const reloaded = await prisma.cBTAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(reloaded.deadlineAt.getTime() - originalDeadline).toBe(15 * 60_000); // delta: 25 - 10
  });

  it("rejects a negative extension and an unknown candidate", async () => {
    const f = await makeSecurityFixture();
    const candidate = await prisma.cBTExamCandidate.findFirstOrThrow({ where: { examId: f.exam.id, studentId: f.student.id } });
    await expect(grantExamExtension(f.school.id, f.teacher.id, candidate.id, -5, null)).rejects.toThrow(/negative/i);
    await expect(grantExamExtension(f.school.id, f.teacher.id, "nonexistent", 5, null)).rejects.toThrow(/not found/i);
  });
});
