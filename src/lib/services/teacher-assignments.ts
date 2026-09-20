import "server-only";
import { prisma } from "@/lib/db";

export async function listTeacherAssignments(schoolId: string) {
  return prisma.teacherAssignment.findMany({
    where: { schoolId },
    include: { teacher: true, subject: true, classArm: { include: { classGroup: true } } },
    orderBy: [{ classArm: { classGroup: { order: "asc" } } }, { subject: { name: "asc" } }],
  });
}

export async function listTeachers(schoolId: string) {
  return prisma.user.findMany({
    where: { schoolId, role: { key: "TEACHER" } },
    orderBy: { name: "asc" },
  });
}

// Assigns one teacher to every subject x class combination in a single submission.
// Combinations that already exist are skipped rather than failing the whole batch.
export async function createTeacherAssignments(
  schoolId: string,
  input: { teacherId: string; subjectIds: string[]; classArmIds: string[] }
) {
  const [teacher, subjects, classArms, existing] = await Promise.all([
    prisma.user.findFirst({ where: { id: input.teacherId, schoolId } }),
    prisma.subject.findMany({ where: { id: { in: input.subjectIds }, schoolId } }),
    prisma.classArm.findMany({ where: { id: { in: input.classArmIds }, schoolId } }),
    prisma.teacherAssignment.findMany({
      where: { schoolId, teacherId: input.teacherId, subjectId: { in: input.subjectIds }, classArmId: { in: input.classArmIds } },
      select: { subjectId: true, classArmId: true },
    }),
  ]);
  if (!teacher) throw new Error("Select a valid teacher.");
  if (subjects.length !== input.subjectIds.length) throw new Error("Select valid subjects.");
  if (classArms.length !== input.classArmIds.length) throw new Error("Select valid classes.");

  const existingKeys = new Set(existing.map((a) => `${a.subjectId}:${a.classArmId}`));
  const rows = input.subjectIds
    .flatMap((subjectId) => input.classArmIds.map((classArmId) => ({ subjectId, classArmId })))
    .filter(({ subjectId, classArmId }) => !existingKeys.has(`${subjectId}:${classArmId}`));

  if (rows.length > 0) {
    await prisma.teacherAssignment.createMany({
      data: rows.map(({ subjectId, classArmId }) => ({ schoolId, teacherId: input.teacherId, subjectId, classArmId })),
    });
  }

  return { created: rows.length, skipped: input.subjectIds.length * input.classArmIds.length - rows.length };
}

export async function deleteTeacherAssignment(schoolId: string, id: string) {
  const existing = await prisma.teacherAssignment.findFirst({ where: { schoolId, id } });
  if (!existing) throw new Error("Assignment not found");
  await prisma.teacherAssignment.delete({ where: { id } });
}

/// A teacher "teaches" a class arm if assigned to any subject there, or is
/// its designated class teacher.
export async function classArmIdsForTeacher(schoolId: string, teacherId: string) {
  const [assignments, ledArms] = await Promise.all([
    prisma.teacherAssignment.findMany({ where: { schoolId, teacherId }, select: { classArmId: true } }),
    prisma.classArm.findMany({ where: { schoolId, classTeacherId: teacherId }, select: { id: true } }),
  ]);
  return Array.from(new Set([...assignments.map((a) => a.classArmId), ...ledArms.map((a) => a.id)]));
}
