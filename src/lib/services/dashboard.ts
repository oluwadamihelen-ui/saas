import "server-only";
import { prisma } from "@/lib/db";

export async function getDashboardStats(schoolId: string) {
  const [totalStudents, activeStudents, totalStaff, totalClassArms, currentSession, recentStudents] =
    await Promise.all([
      prisma.student.count({ where: { schoolId } }),
      prisma.student.count({ where: { schoolId, status: "ACTIVE" } }),
      prisma.user.count({ where: { schoolId, status: "ACTIVE" } }),
      prisma.classArm.count({ where: { schoolId } }),
      prisma.academicSession.findFirst({
        where: { schoolId, isCurrent: true },
        include: { terms: { where: { isCurrent: true } } },
      }),
      prisma.student.findMany({
        where: { schoolId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { classArm: { include: { classGroup: true } } },
      }),
    ]);

  return {
    totalStudents,
    activeStudents,
    totalStaff,
    totalClassArms,
    currentSession,
    currentTerm: currentSession?.terms[0] ?? null,
    recentStudents,
  };
}
