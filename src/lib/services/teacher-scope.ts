import "server-only";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";

/// Central "is this teacher actually assigned to teach this?" gate for
/// every subject+class-scoped feature (Results, Assignments, CBT) — the
/// same rule Online Learning (lectures.ts/live-classes.ts) already
/// enforces, generalized here so it isn't reinvented per module. Never
/// trust a subjectId/classArmId that arrives from a client without
/// re-checking this server-side, even when the UI's own dropdowns already
/// only offer the teacher's assignments — a crafted request can submit
/// anything.
export async function assertTeacherAssignment(schoolId: string, teacherId: string, subjectId: string, classArmId: string) {
  const assignment = await prisma.teacherAssignment.findFirst({
    where: { schoolId, teacherId, subjectId, classArmId },
  });
  if (!assignment) {
    throw new Error("You are not assigned to teach this subject for this class.");
  }
}

/// Admin-tier roles (ACADEMICS_MANAGE) act on any subject+class pair in
/// the school; everyone else (TEACHER) only on pairs they hold a
/// TeacherAssignment for. Use this instead of calling
/// assertTeacherAssignment directly whenever the acting user might be
/// either kind of role — Results, Assignments and CBT are all reachable
/// by both.
export async function assertCanActOnAssignment(
  schoolId: string,
  userId: string,
  perms: Set<string>,
  subjectId: string,
  classArmId: string
) {
  if (perms.has(PERMISSIONS.ACADEMICS_MANAGE)) return;
  await assertTeacherAssignment(schoolId, userId, subjectId, classArmId);
}

export async function listTeachableAssignments(schoolId: string, teacherId: string) {
  return prisma.teacherAssignment.findMany({
    where: { schoolId, teacherId },
    include: { subject: true, classArm: { include: { classGroup: true } } },
    orderBy: [{ classArm: { classGroup: { order: "asc" } } }, { subject: { name: "asc" } }],
  });
}

/// "ALL" means school-wide (an administrator); an array means "only these
/// exact subject+class pairs" (a teacher, per TeacherAssignment) — the
/// data behind a class/subject picker so a teacher never even sees an
/// option for something canActOnAssignment would reject anyway.
export type AssignmentAccess = "ALL" | { classArmId: string; subjectId: string }[];

export async function getAccessibleAssignments(schoolId: string, userId: string, perms: Set<string>): Promise<AssignmentAccess> {
  if (perms.has(PERMISSIONS.ACADEMICS_MANAGE)) return "ALL";
  return prisma.teacherAssignment.findMany({
    where: { schoolId, teacherId: userId },
    select: { classArmId: true, subjectId: true },
  });
}

export function canActOnAssignment(access: AssignmentAccess, classArmId: string, subjectId: string): boolean {
  if (access === "ALL") return true;
  return access.some((a) => a.classArmId === classArmId && a.subjectId === subjectId);
}

/// Subject-only scoping for features that aren't tied to one class (the
/// CBT question bank — a question is reusable across every class a
/// subject is taught in). "ALL" for admin-tier; otherwise the distinct
/// set of subjectIds the teacher holds any TeacherAssignment for,
/// regardless of which class.
export type SubjectAccess = "ALL" | Set<string>;

export async function getAccessibleSubjectIds(schoolId: string, userId: string, perms: Set<string>): Promise<SubjectAccess> {
  if (perms.has(PERMISSIONS.ACADEMICS_MANAGE)) return "ALL";
  const assignments = await prisma.teacherAssignment.findMany({
    where: { schoolId, teacherId: userId },
    select: { subjectId: true },
  });
  return new Set(assignments.map((a) => a.subjectId));
}

export function canActOnSubject(access: SubjectAccess, subjectId: string): boolean {
  if (access === "ALL") return true;
  return access.has(subjectId);
}

export async function assertCanActOnSubject(schoolId: string, userId: string, perms: Set<string>, subjectId: string) {
  if (perms.has(PERMISSIONS.ACADEMICS_MANAGE)) return;
  const access = await getAccessibleSubjectIds(schoolId, userId, perms);
  if (!canActOnSubject(access, subjectId)) {
    throw new Error("You are not assigned to teach this subject.");
  }
}

/// CBT exams carry one subjectId but any number of classArmIds (see
/// ExamInput.classArmIds) — every one of them has to be checked against
/// that same subject, not just one, since a single exam action snapshots
/// candidates across all of them at once.
export async function assertCanActOnExamInput(
  schoolId: string,
  userId: string,
  perms: Set<string>,
  subjectId: string,
  classArmIds: string[]
) {
  await assertCanActOnSubject(schoolId, userId, perms, subjectId);
  if (perms.has(PERMISSIONS.ACADEMICS_MANAGE)) return;
  for (const classArmId of classArmIds) {
    await assertTeacherAssignment(schoolId, userId, subjectId, classArmId);
  }
}
