import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";

let counter = 0;

/// A full-enough school fixture for the Notification Center test suite:
/// one active session/term, one subject, one class arm, a teacher
/// assigned to it, one admin holding academics.manage + finance.view +
/// birthdays.view (the exact set the rule engine's admin/birthday rules
/// look for), one student enrolled in the class with a portal account,
/// and one guardian (linked to that student) with a portal account —
/// covering every recipient shape the rule engine and event hooks need.
export async function makeNotificationsSchool(namePrefix: string) {
  counter += 1;
  const slug = `vitest-notif-${namePrefix}-${Date.now()}-${counter}`;
  const school = await prisma.school.create({ data: { name: slug, slug, status: "ACTIVE" } });

  const permission = async (key: string, module: string) =>
    prisma.permission.upsert({ where: { key }, create: { key, module, action: key.split(".")[1], description: key }, update: {} });

  const academicsManage = await permission(PERMISSIONS.ACADEMICS_MANAGE, "academics");
  const financeView = await permission(PERMISSIONS.FINANCE_VIEW, "finance");
  const birthdaysView = await permission(PERMISSIONS.BIRTHDAYS_VIEW, "birthdays");

  const adminRole = await prisma.role.create({ data: { schoolId: school.id, key: "SCHOOL_OWNER", name: "Owner" } });
  const teacherRole = await prisma.role.create({ data: { schoolId: school.id, key: "TEACHER", name: "Teacher" } });
  const parentRole = await prisma.role.create({ data: { schoolId: school.id, key: "PARENT", name: "Parent" } });
  const studentRole = await prisma.role.create({ data: { schoolId: school.id, key: "STUDENT", name: "Student" } });

  await prisma.rolePermission.createMany({
    data: [academicsManage, financeView, birthdaysView].map((p) => ({ roleId: adminRole.id, permissionId: p.id })),
  });

  const admin = await prisma.user.create({
    data: { schoolId: school.id, roleId: adminRole.id, email: `admin-${slug}@vitest.local`, passwordHash: "x", name: "Admin", status: "ACTIVE" },
  });
  const teacher = await prisma.user.create({
    data: { schoolId: school.id, roleId: teacherRole.id, email: `teacher-${slug}@vitest.local`, passwordHash: "x", name: "Teacher", status: "ACTIVE" },
  });
  const guardianUser = await prisma.user.create({
    data: { schoolId: school.id, roleId: parentRole.id, email: `parent-${slug}@vitest.local`, passwordHash: "x", name: "Parent", status: "ACTIVE" },
  });
  const studentUser = await prisma.user.create({
    data: { schoolId: school.id, roleId: studentRole.id, email: `student-${slug}@vitest.local`, passwordHash: "x", name: "Student User", status: "ACTIVE" },
  });

  const session = await prisma.academicSession.create({
    data: { schoolId: school.id, name: "2025/2026", startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true },
  });
  const term = await prisma.term.create({
    data: { schoolId: school.id, academicSessionId: session.id, name: "First Term", startDate: new Date("2025-09-01"), endDate: new Date("2025-12-15"), isCurrent: true },
  });

  const subject = await prisma.subject.create({ data: { schoolId: school.id, name: "Mathematics", code: `MTH-${counter}` } });
  const classGroup = await prisma.classGroup.create({ data: { schoolId: school.id, name: "JSS 2", order: 1 } });
  const classArm = await prisma.classArm.create({ data: { schoolId: school.id, classGroupId: classGroup.id, name: "A" } });

  await prisma.teacherAssignment.create({ data: { schoolId: school.id, teacherId: teacher.id, subjectId: subject.id, classArmId: classArm.id } });

  const guardian = await prisma.guardian.create({
    data: { schoolId: school.id, firstName: "Parent", lastName: "One", phone: "0800000000", userId: guardianUser.id },
  });
  const student = await prisma.student.create({
    data: {
      schoolId: school.id,
      firstName: "Student",
      lastName: "One",
      admissionNumber: `ADM-${slug}`,
      status: "ACTIVE",
      classArmId: classArm.id,
      userId: studentUser.id,
    },
  });
  await prisma.studentGuardian.create({ data: { studentId: student.id, guardianId: guardian.id, relationship: "MOTHER", isPrimary: true } });

  const adminPerms = new Set<string>([PERMISSIONS.ACADEMICS_MANAGE, PERMISSIONS.FINANCE_VIEW, PERMISSIONS.BIRTHDAYS_VIEW]);

  return {
    school,
    admin,
    teacher,
    guardianUser,
    studentUser,
    guardian,
    student,
    session,
    term,
    subject,
    classGroup,
    classArm,
    adminPerms,
  };
}
