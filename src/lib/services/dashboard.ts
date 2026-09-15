import "server-only";
import { prisma } from "@/lib/db";

export async function getDashboardStats(schoolId: string) {
  const [totalStudents, activeStudents, totalStaff, totalClassArms, currentSession] = await Promise.all([
    prisma.student.count({ where: { schoolId } }),
    prisma.student.count({ where: { schoolId, status: "ACTIVE" } }),
    prisma.user.count({ where: { schoolId, status: "ACTIVE" } }),
    prisma.classArm.count({ where: { schoolId } }),
    prisma.academicSession.findFirst({
      where: { schoolId, isCurrent: true },
      include: { terms: { where: { isCurrent: true } } },
    }),
  ]);

  return {
    totalStudents,
    activeStudents,
    totalStaff,
    totalClassArms,
    currentSession,
    currentTerm: currentSession?.terms[0] ?? null,
  };
}

const RECENTLY_ENROLLED_PAGE_SIZE = 5;

/// The "Recently enrolled" dashboard widget's own paginated feed — every
/// student, newest first, 5 at a time. Deliberately separate from
/// listStudents (which sorts alphabetically for the full directory, not
/// by enrollment recency) rather than overloading that function with a
/// second sort order.
export async function getRecentlyEnrolledStudents(schoolId: string, page = 1) {
  const currentPage = Math.max(1, page);
  const where = { schoolId };
  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * RECENTLY_ENROLLED_PAGE_SIZE,
      take: RECENTLY_ENROLLED_PAGE_SIZE,
      include: { classArm: { include: { classGroup: true } } },
    }),
    prisma.student.count({ where }),
  ]);
  return { students, total, page: currentPage, pageCount: Math.max(1, Math.ceil(total / RECENTLY_ENROLLED_PAGE_SIZE)) };
}
