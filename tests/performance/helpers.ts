import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";

let counter = 0;

/// A full-enough school fixture for the performance-analysis test suite:
/// one session, two terms, two subjects, one assessment component, one
/// class group with two arms, a teacher assigned only to arm A, and an
/// admin with academics.manage (school-wide access per
/// authorization.ts). Shared across analysis.test.ts and
/// security.test.ts so both exercise the exact same fixture shape.
export async function makeSchool(namePrefix: string) {
  counter += 1;
  const slug = `vitest-perf-${namePrefix}-${Date.now()}-${counter}`;
  const school = await prisma.school.create({ data: { name: slug, slug, status: "ACTIVE" } });

  const teacherRole = await prisma.role.create({ data: { schoolId: school.id, key: "TEACHER", name: "Teacher" } });
  const adminRole = await prisma.role.create({ data: { schoolId: school.id, key: "SCHOOL_ADMIN", name: "School Administrator" } });

  const teacher = await prisma.user.create({
    data: { schoolId: school.id, roleId: teacherRole.id, email: `teacher-${slug}@vitest.local`, passwordHash: "x", name: "Teacher" },
  });
  const admin = await prisma.user.create({
    data: { schoolId: school.id, roleId: adminRole.id, email: `admin-${slug}@vitest.local`, passwordHash: "x", name: "Admin" },
  });

  const session = await prisma.academicSession.create({
    data: { schoolId: school.id, name: "2025/2026", startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true },
  });
  const term1 = await prisma.term.create({
    data: { schoolId: school.id, academicSessionId: session.id, name: "First Term", startDate: new Date("2025-09-01"), endDate: new Date("2025-12-15") },
  });
  const term2 = await prisma.term.create({
    data: { schoolId: school.id, academicSessionId: session.id, name: "Second Term", startDate: new Date("2026-01-05"), endDate: new Date("2026-04-01"), isCurrent: true },
  });

  const mathSubject = await prisma.subject.create({ data: { schoolId: school.id, name: "Mathematics", code: "MTH" } });
  const engSubject = await prisma.subject.create({ data: { schoolId: school.id, name: "English", code: "ENG" } });
  const component = await prisma.assessmentComponent.create({ data: { schoolId: school.id, name: "Exam", maxScore: 100, order: 0 } });

  const classGroup = await prisma.classGroup.create({ data: { schoolId: school.id, name: "JSS 2", order: 1 } });
  const armA = await prisma.classArm.create({ data: { schoolId: school.id, classGroupId: classGroup.id, name: "A" } });
  const armB = await prisma.classArm.create({ data: { schoolId: school.id, classGroupId: classGroup.id, name: "B" } });

  await prisma.teacherAssignment.create({ data: { schoolId: school.id, teacherId: teacher.id, subjectId: mathSubject.id, classArmId: armA.id } });

  const teacherPerms = new Set([PERMISSIONS.RESULTS_VIEW, PERMISSIONS.ATTENDANCE_VIEW]);
  const adminPerms = new Set([PERMISSIONS.RESULTS_VIEW, PERMISSIONS.ATTENDANCE_VIEW, PERMISSIONS.ACADEMICS_MANAGE]);

  return { school, teacher, admin, teacherPerms, adminPerms, session, term1, term2, mathSubject, engSubject, component, classGroup, armA, armB };
}
