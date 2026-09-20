import "server-only";
import { prisma } from "@/lib/db";
import { readViewAsGrant, isAuthorizedToViewStudent } from "@/lib/services/view-as";

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

/// The student whose portal a page should render: the session user's own
/// record when they're actually logged in as a student, or — for a school
/// owner/head of school checking on any student, or a guardian checking on
/// their own child — whichever student a validated "view as" grant (see
/// view-as.ts) names, re-authorized fresh on every call rather than
/// trusted from the cookie alone. Only the read-only, purely-informational
/// portal pages call this (dashboard home, assignments, announcements,
/// attendance, results, timetable, CBT list/results, online-learning) —
/// deliberately not the CBT attempt-taking page, feedback, or
/// notifications, which still resolve identity from the session's own
/// userId the normal way and simply show nothing/404 for a viewer with no
/// Student row of their own. That's what keeps "view as" read-only: a
/// viewer can look at a child's data through these pages, but no action
/// anywhere is ever taken as that child.
export async function resolveViewedStudent(
  schoolId: string,
  sessionUser: { id: string; role: string }
): Promise<{ student: NonNullable<Awaited<ReturnType<typeof getStudentForUser>>>; viewingAs: boolean } | null> {
  if (sessionUser.role === "STUDENT") {
    const student = await getStudentForUser(schoolId, sessionUser.id);
    return student ? { student, viewingAs: false } : null;
  }

  const grant = await readViewAsGrant();
  if (!grant || grant.viewerId !== sessionUser.id) return null;

  const authorized = await isAuthorizedToViewStudent(schoolId, sessionUser, grant.studentId);
  if (!authorized) return null;

  const student = await prisma.student.findFirst({
    where: { schoolId, id: grant.studentId },
    include: { classArm: { include: { classGroup: true } }, campus: true },
  });
  return student ? { student, viewingAs: true } : null;
}
