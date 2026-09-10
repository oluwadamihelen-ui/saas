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

export async function createTeacherAssignment(
  schoolId: string,
  input: { teacherId: string; subjectId: string; classArmId: string }
) {
  const [teacher, subject, classArm] = await Promise.all([
    prisma.user.findFirst({ where: { id: input.teacherId, schoolId } }),
    prisma.subject.findFirst({ where: { id: input.subjectId, schoolId } }),
    prisma.classArm.findFirst({ where: { id: input.classArmId, schoolId } }),
  ]);
  if (!teacher || !subject || !classArm) throw new Error("Select a valid teacher, subject and class.");

  const existing = await prisma.teacherAssignment.findFirst({
    where: { schoolId, teacherId: input.teacherId, subjectId: input.subjectId, classArmId: input.classArmId },
  });
  if (existing) throw new Error("This teacher is already assigned to this subject and class.");

  return prisma.teacherAssignment.create({
    data: { schoolId, teacherId: input.teacherId, subjectId: input.subjectId, classArmId: input.classArmId },
  });
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
