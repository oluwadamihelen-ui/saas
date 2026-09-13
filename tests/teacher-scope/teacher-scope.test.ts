import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  assertTeacherAssignment,
  assertCanActOnAssignment,
  getAccessibleAssignments,
  canActOnAssignment,
  getAccessibleSubjectIds,
  canActOnSubject,
  assertCanActOnSubject,
  assertCanActOnExamInput,
} from "@/lib/services/teacher-scope";
import { listAssignments, getSubmissionScope } from "@/lib/services/assignments";
import { listExams } from "@/lib/services/cbt-exams";
import { listQuestions } from "@/lib/services/cbt-questions";
import { listGradingQueue } from "@/lib/services/cbt-grading";
import { PERMISSIONS } from "@/lib/permissions";
import { makeSchool } from "../performance/helpers";
import { cleanupTestSchools } from "../helpers/factories";

afterAll(cleanupTestSchools);

// The shared "is this teacher actually assigned to teach this?" gate
// behind Results, Assignments, Timetable and every CBT surface — a
// teacher must never see or act on a subject/class they don't hold a
// TeacherAssignment for, while ACADEMICS_MANAGE roles bypass the gate
// entirely (same admin-tier model as Attendance).
describe("teacher-scope — subject+class pair scoping", () => {
  it("assertTeacherAssignment resolves for an assigned pair and throws for an unassigned one", async () => {
    const { school, teacher, mathSubject, engSubject, armA, armB } = await makeSchool("scope-assert");
    await expect(assertTeacherAssignment(school.id, teacher.id, mathSubject.id, armA.id)).resolves.toBeUndefined();
    await expect(assertTeacherAssignment(school.id, teacher.id, mathSubject.id, armB.id)).rejects.toThrow();
    await expect(assertTeacherAssignment(school.id, teacher.id, engSubject.id, armA.id)).rejects.toThrow();
  });

  it("assertCanActOnAssignment bypasses the check entirely for ACADEMICS_MANAGE", async () => {
    const { school, admin, adminPerms, engSubject, armB } = await makeSchool("scope-bypass");
    await expect(assertCanActOnAssignment(school.id, admin.id, adminPerms, engSubject.id, armB.id)).resolves.toBeUndefined();
  });

  it("getAccessibleAssignments/canActOnAssignment reflect exactly the teacher's own TeacherAssignment rows", async () => {
    const { school, teacher, teacherPerms, adminPerms, admin, mathSubject, engSubject, armA, armB } = await makeSchool("scope-access");

    const access = await getAccessibleAssignments(school.id, teacher.id, teacherPerms);
    expect(access).not.toBe("ALL");
    expect(canActOnAssignment(access, armA.id, mathSubject.id)).toBe(true);
    expect(canActOnAssignment(access, armB.id, mathSubject.id)).toBe(false);
    expect(canActOnAssignment(access, armA.id, engSubject.id)).toBe(false);

    const adminAccess = await getAccessibleAssignments(school.id, admin.id, adminPerms);
    expect(adminAccess).toBe("ALL");
    expect(canActOnAssignment(adminAccess, armB.id, engSubject.id)).toBe(true);
  });

  it("a teacher with zero TeacherAssignment rows gets an empty access list, not ALL", async () => {
    const { school, teacher, armA, mathSubject } = await makeSchool("scope-empty");
    const otherTeacher = await prisma.user.create({
      data: { schoolId: school.id, roleId: teacher.roleId, email: `other-${Date.now()}@vitest.local`, passwordHash: "x", name: "Other Teacher" },
    });
    const perms = new Set([PERMISSIONS.RESULTS_VIEW]);
    const access = await getAccessibleAssignments(school.id, otherTeacher.id, perms);
    expect(access).not.toBe("ALL");
    if (access !== "ALL") expect(access.length).toBe(0);
    expect(canActOnAssignment(access, armA.id, mathSubject.id)).toBe(false);
  });
});

describe("teacher-scope — subject-only scoping (question bank / exam list)", () => {
  it("getAccessibleSubjectIds/canActOnSubject only include subjects the teacher has any TeacherAssignment for", async () => {
    const { school, teacher, teacherPerms, mathSubject, engSubject } = await makeSchool("subj-access");
    const access = await getAccessibleSubjectIds(school.id, teacher.id, teacherPerms);
    expect(access).not.toBe("ALL");
    expect(canActOnSubject(access, mathSubject.id)).toBe(true);
    expect(canActOnSubject(access, engSubject.id)).toBe(false);
  });

  it("assertCanActOnSubject throws for an unassigned subject and resolves for an assigned one", async () => {
    const { school, teacher, teacherPerms, mathSubject, engSubject } = await makeSchool("subj-assert");
    await expect(assertCanActOnSubject(school.id, teacher.id, teacherPerms, mathSubject.id)).resolves.toBeUndefined();
    await expect(assertCanActOnSubject(school.id, teacher.id, teacherPerms, engSubject.id)).rejects.toThrow();
  });

  it("assertCanActOnExamInput checks every requested classArmId against the exam's subject, not just one", async () => {
    const { school, teacher, teacherPerms, mathSubject, armA, armB } = await makeSchool("exam-input");
    // armA is assigned for mathSubject; armB is not.
    await expect(assertCanActOnExamInput(school.id, teacher.id, teacherPerms, mathSubject.id, [armA.id])).resolves.toBeUndefined();
    await expect(assertCanActOnExamInput(school.id, teacher.id, teacherPerms, mathSubject.id, [armA.id, armB.id])).rejects.toThrow();
  });
});

describe("Assignments — teacher scoping", () => {
  it("listAssignments only returns assignments for the teacher's own subject+class pairs", async () => {
    const { school, teacher, teacherPerms, mathSubject, engSubject, armA, armB } = await makeSchool("assign-list");
    const term = await prisma.term.create({
      data: { schoolId: school.id, academicSessionId: (await prisma.academicSession.findFirstOrThrow({ where: { schoolId: school.id } })).id, name: "T", startDate: new Date(), endDate: new Date(Date.now() + 86400000), isCurrent: true },
    });
    await prisma.assignment.create({
      data: { schoolId: school.id, classArmId: armA.id, subjectId: mathSubject.id, teacherId: teacher.id, termId: term.id, title: "In scope", dueDate: new Date() },
    });
    await prisma.assignment.create({
      data: { schoolId: school.id, classArmId: armB.id, subjectId: engSubject.id, teacherId: teacher.id, termId: term.id, title: "Out of scope", dueDate: new Date() },
    });

    const access = await getAccessibleAssignments(school.id, teacher.id, teacherPerms);
    const { assignments, total } = await listAssignments(school.id, 1, access);
    expect(total).toBe(1);
    expect(assignments[0].title).toBe("In scope");
  });

  it("getSubmissionScope resolves the classArmId/subjectId a submission belongs to, for the grading action's pre-check", async () => {
    const { school, teacher, mathSubject, armA } = await makeSchool("assign-scope");
    const term = await prisma.term.create({
      data: { schoolId: school.id, academicSessionId: (await prisma.academicSession.findFirstOrThrow({ where: { schoolId: school.id } })).id, name: "T", startDate: new Date(), endDate: new Date(Date.now() + 86400000), isCurrent: true },
    });
    const student = await prisma.student.create({
      data: { schoolId: school.id, admissionNumber: `ASG-${Date.now()}`, firstName: "A", lastName: "B", classArmId: armA.id, status: "ACTIVE" },
    });
    const assignment = await prisma.assignment.create({
      data: { schoolId: school.id, classArmId: armA.id, subjectId: mathSubject.id, teacherId: teacher.id, termId: term.id, title: "T", dueDate: new Date() },
    });
    const submission = await prisma.assignmentSubmission.create({
      data: { assignmentId: assignment.id, studentId: student.id },
    });

    const scope = await getSubmissionScope(school.id, submission.id);
    expect(scope?.classArmId).toBe(armA.id);
    expect(scope?.subjectId).toBe(mathSubject.id);
  });
});

describe("CBT exams — subject scoping", () => {
  it("listExams excludes exams for subjects the teacher isn't assigned to teach", async () => {
    const { school, teacher, teacherPerms, mathSubject, engSubject } = await makeSchool("cbt-exam-list");
    const term = await prisma.term.create({
      data: { schoolId: school.id, academicSessionId: (await prisma.academicSession.findFirstOrThrow({ where: { schoolId: school.id } })).id, name: "T", startDate: new Date(), endDate: new Date(Date.now() + 86400000), isCurrent: true },
    });
    const examType = await prisma.cBTExamTypeOption.create({ data: { schoolId: school.id, key: "TEST", label: "Test" } });
    await prisma.cBTExam.create({
      data: {
        schoolId: school.id, title: "In scope", examTypeId: examType.id, subjectId: mathSubject.id, termId: term.id,
        status: "DRAFT", questionSelectionMode: "MANUAL", startAt: new Date(), endAt: new Date(Date.now() + 3600_000), durationMinutes: 30, createdById: teacher.id,
      },
    });
    await prisma.cBTExam.create({
      data: {
        schoolId: school.id, title: "Out of scope", examTypeId: examType.id, subjectId: engSubject.id, termId: term.id,
        status: "DRAFT", questionSelectionMode: "MANUAL", startAt: new Date(), endAt: new Date(Date.now() + 3600_000), durationMinutes: 30, createdById: teacher.id,
      },
    });

    const subjectAccess = await getAccessibleSubjectIds(school.id, teacher.id, teacherPerms);
    const { exams, total } = await listExams(school.id, {}, subjectAccess);
    expect(total).toBe(1);
    expect(exams[0].title).toBe("In scope");
  });

  it("a requested subjectId filter outside the teacher's set returns nothing rather than falling back to all their subjects", async () => {
    const { school, teacher, teacherPerms, engSubject } = await makeSchool("cbt-exam-filter");
    const subjectAccess = await getAccessibleSubjectIds(school.id, teacher.id, teacherPerms);
    const { total } = await listExams(school.id, { subjectId: engSubject.id }, subjectAccess);
    expect(total).toBe(0);
  });
});

describe("CBT question bank — subject scoping", () => {
  it("listQuestions excludes questions for subjects the teacher isn't assigned to teach", async () => {
    const { school, teacher, teacherPerms, mathSubject, engSubject } = await makeSchool("cbt-qbank");
    await prisma.cBTQuestion.create({
      data: { schoolId: school.id, subjectId: mathSubject.id, type: "SHORT_ANSWER", status: "APPROVED", source: "MANUAL", difficulty: "EASY", prompt: "In scope", marks: 1, createdById: teacher.id },
    });
    await prisma.cBTQuestion.create({
      data: { schoolId: school.id, subjectId: engSubject.id, type: "SHORT_ANSWER", status: "APPROVED", source: "MANUAL", difficulty: "EASY", prompt: "Out of scope", marks: 1, createdById: teacher.id },
    });

    const subjectAccess = await getAccessibleSubjectIds(school.id, teacher.id, teacherPerms);
    const { questions, total } = await listQuestions(school.id, {}, subjectAccess);
    expect(total).toBe(1);
    expect(questions[0].prompt).toBe("In scope");
  });
});

describe("CBT grading queue — subject scoping", () => {
  it("listGradingQueue excludes essay answers for exams outside the teacher's assigned subjects", async () => {
    const { school, teacher, teacherPerms, mathSubject, engSubject, armA } = await makeSchool("cbt-grading");
    const term = await prisma.term.create({
      data: { schoolId: school.id, academicSessionId: (await prisma.academicSession.findFirstOrThrow({ where: { schoolId: school.id } })).id, name: "T", startDate: new Date(), endDate: new Date(Date.now() + 86400000), isCurrent: true },
    });
    const examType = await prisma.cBTExamTypeOption.create({ data: { schoolId: school.id, key: "TEST2", label: "Test" } });
    const student = await prisma.student.create({
      data: { schoolId: school.id, admissionNumber: `GRD-${Date.now()}`, firstName: "A", lastName: "B", classArmId: armA.id, status: "ACTIVE" },
    });

    async function makeEssayAwaitingGrade(subjectId: string, label: string) {
      const exam = await prisma.cBTExam.create({
        data: {
          schoolId: school.id, title: label, examTypeId: examType.id, subjectId, termId: term.id,
          status: "LIVE", questionSelectionMode: "MANUAL", startAt: new Date(), endAt: new Date(Date.now() + 3600_000), durationMinutes: 30, createdById: teacher.id,
        },
      });
      const question = await prisma.cBTQuestion.create({
        data: { schoolId: school.id, subjectId, type: "ESSAY", status: "APPROVED", source: "MANUAL", difficulty: "EASY", prompt: label, marks: 5, createdById: teacher.id },
      });
      const candidate = await prisma.cBTExamCandidate.create({
        data: { schoolId: school.id, examId: exam.id, studentId: student.id },
      });
      const attempt = await prisma.cBTAttempt.create({
        data: { schoolId: school.id, examId: exam.id, candidateId: candidate.id, studentId: student.id, status: "SUBMITTED", startedAt: new Date(), deadlineAt: new Date(Date.now() + 3600_000) },
      });
      await prisma.cBTAnswer.create({
        data: { attemptId: attempt.id, questionId: question.id, gradingStatus: "NEEDS_MANUAL_GRADING" },
      });
    }

    await makeEssayAwaitingGrade(mathSubject.id, "In scope essay");
    await makeEssayAwaitingGrade(engSubject.id, "Out of scope essay");

    const subjectAccess = await getAccessibleSubjectIds(school.id, teacher.id, teacherPerms);
    const queue = await listGradingQueue(school.id, {}, subjectAccess);
    expect(queue.length).toBe(1);
    expect(queue[0].question.prompt).toBe("In scope essay");
  });
});
