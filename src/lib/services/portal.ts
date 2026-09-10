import "server-only";
import { prisma } from "@/lib/db";

export async function getGuardianForUser(schoolId: string, userId: string) {
  return prisma.guardian.findFirst({
    where: { schoolId, userId },
    include: {
      students: {
        include: { student: { include: { classArm: { include: { classGroup: true } } } } },
      },
    },
  });
}

/// Verifies studentId is actually one of this guardian's children before
/// handing back full detail — a parent can't view another family's child
/// by guessing an id in the URL.
export async function getChildForGuardian(schoolId: string, userId: string, studentId: string) {
  const guardian = await getGuardianForUser(schoolId, userId);
  if (!guardian) return null;
  const isMyChild = guardian.students.some((sg) => sg.studentId === studentId);
  if (!isMyChild) return null;

  return prisma.student.findFirst({
    where: { schoolId, id: studentId },
    include: { classArm: { include: { classGroup: true } }, campus: true },
  });
}

export async function getStudentForUser(schoolId: string, userId: string) {
  return prisma.student.findFirst({
    where: { schoolId, userId },
    include: { classArm: { include: { classGroup: true } }, campus: true },
  });
}
