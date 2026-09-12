import { prisma } from "@/lib/db";

let counter = 0;

/// A minimal Nursery-1-shaped fixture for the Pre-School Milestone Results
/// tests: a school with a TEACHER and a PRINCIPAL, an academic session/term,
/// a MILESTONE-mode class + arm, an English Language subject, and one
/// active student. Individual tests layer a Scheme of Work, milestones,
/// assessment periods and assessments on top via the real service
/// functions, the same way the feature is actually used.
export async function makePreschoolFixture() {
  counter += 1;
  const slug = `vitest-preschool-${Date.now()}-${counter}`;

  const school = await prisma.school.create({ data: { name: slug, slug, status: "ACTIVE" } });

  const teacherRole = await prisma.role.create({ data: { schoolId: school.id, key: "TEACHER", name: "Teacher" } });
  const principalRole = await prisma.role.create({ data: { schoolId: school.id, key: "PRINCIPAL", name: "Principal" } });
  const teacher = await prisma.user.create({
    data: { schoolId: school.id, roleId: teacherRole.id, email: `${slug}-teacher@vitest.local`, passwordHash: "x", name: "Teacher" },
  });
  const principal = await prisma.user.create({
    data: { schoolId: school.id, roleId: principalRole.id, email: `${slug}-principal@vitest.local`, passwordHash: "x", name: "Principal" },
  });

  const session = await prisma.academicSession.create({
    data: { schoolId: school.id, name: "2025/2026", startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true },
  });
  const term = await prisma.term.create({
    data: { schoolId: school.id, academicSessionId: session.id, name: "First Term", startDate: new Date("2025-09-01"), endDate: new Date("2025-12-15"), isCurrent: true },
  });

  const classGroup = await prisma.classGroup.create({ data: { schoolId: school.id, name: "Nursery 1", order: 0, assessmentMode: "MILESTONE" } });
  const classArm = await prisma.classArm.create({ data: { schoolId: school.id, classGroupId: classGroup.id, name: "A" } });

  const subject = await prisma.subject.create({ data: { schoolId: school.id, name: "English Language", code: `${slug}-ENG` } });

  const student = await prisma.student.create({
    data: {
      schoolId: school.id,
      classArmId: classArm.id,
      firstName: "Abayo",
      lastName: "TestStudent",
      admissionNumber: `${slug}-adm1`,
      dateOfBirth: new Date("2020-01-01"),
      gender: "MALE",
      status: "ACTIVE",
    },
  });

  return { school, teacher, principal, session, term, classGroup, classArm, subject, student };
}

export type PreschoolFixture = Awaited<ReturnType<typeof makePreschoolFixture>>;
