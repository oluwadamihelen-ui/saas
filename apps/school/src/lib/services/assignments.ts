import "server-only";
import { prisma } from "@/lib/db";

const PAGE_SIZE = 20;

export async function listAssignments(schoolId: string, page = 1) {
  const currentPage = Math.max(1, page);
  const [assignments, total] = await Promise.all([
    prisma.assignment.findMany({
      where: { schoolId },
      include: {
        classArm: { include: { classGroup: true } },
        subject: true,
        teacher: true,
        submissions: true,
      },
      orderBy: { dueDate: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.assignment.count({ where: { schoolId } }),
  ]);
  return {
    assignments: assignments.map((a) => ({
      ...a,
      gradedCount: a.submissions.filter((s) => s.status === "GRADED").length,
      totalCount: a.submissions.length,
    })),
    total,
    page: currentPage,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/// A student/parent-facing view: what's owed and what's already graded for
/// one specific student, not a teacher's whole-class gradebook.
export async function listAssignmentsForStudent(schoolId: string, studentId: string) {
  return prisma.assignmentSubmission.findMany({
    where: { studentId, assignment: { schoolId } },
    include: { assignment: { include: { subject: true, classArm: { include: { classGroup: true } } } } },
    orderBy: { assignment: { dueDate: "desc" } },
  });
}

export async function getAssignment(schoolId: string, id: string) {
  return prisma.assignment.findFirst({
    where: { schoolId, id },
    include: {
      classArm: { include: { classGroup: true } },
      subject: true,
      teacher: true,
      submissions: { include: { student: true }, orderBy: [{ student: { lastName: "asc" } }] },
    },
  });
}

export interface AssignmentInput {
  classArmId: string;
  subjectId: string;
  title: string;
  description?: string | null;
  dueDate: Date;
}

/// Creates one submission row per active student in the class up front —
/// there's no student portal yet (Phase 4) for self-service submission, so
/// this gives the teacher an immediate gradebook to mark up.
export async function createAssignment(schoolId: string, teacherId: string, input: AssignmentInput) {
  const term = await prisma.term.findFirst({ where: { schoolId, isCurrent: true } });
  if (!term) throw new Error("No active term is configured for this school.");

  const students = await prisma.student.findMany({
    where: { schoolId, classArmId: input.classArmId, status: "ACTIVE" },
    select: { id: true },
  });

  return prisma.$transaction(async (tx) => {
    const assignment = await tx.assignment.create({
      data: {
        schoolId,
        classArmId: input.classArmId,
        subjectId: input.subjectId,
        teacherId,
        termId: term.id,
        title: input.title,
        description: input.description || null,
        dueDate: input.dueDate,
      },
    });

    if (students.length > 0) {
      await tx.assignmentSubmission.createMany({
        data: students.map((s) => ({ assignmentId: assignment.id, studentId: s.id })),
      });
    }

    return assignment;
  });
}

export async function gradeSubmission(
  schoolId: string,
  gradedById: string,
  submissionId: string,
  input: { status: "SUBMITTED" | "GRADED"; score?: number | null; feedback?: string | null }
) {
  const submission = await prisma.assignmentSubmission.findFirst({
    where: { id: submissionId, assignment: { schoolId } },
  });
  if (!submission) throw new Error("Submission not found");

  return prisma.assignmentSubmission.update({
    where: { id: submissionId },
    data: {
      status: input.status,
      score: input.score ?? undefined,
      feedback: input.feedback ?? undefined,
      gradedAt: input.status === "GRADED" ? new Date() : undefined,
      gradedById: input.status === "GRADED" ? gradedById : undefined,
    },
  });
}
