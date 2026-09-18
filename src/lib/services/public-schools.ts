import { prisma } from "@/lib/db";

/// Public — powers the school picker on the unauthenticated student login
/// tab, so students select their school instead of typing its slug from
/// memory (a common source of failed logins). Returns every school
/// regardless of status: student sign-in itself doesn't gate on school
/// status, so the picker shouldn't hide one a student could otherwise log
/// into.
export async function listSchoolsForStudentLogin() {
  return prisma.school.findMany({
    select: { slug: true, name: true },
    orderBy: { name: "asc" },
  });
}
