import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { getAccessibleClassArmIds, canAccessClassArm } from "@/lib/services/performance/authorization";
import { markAttendance } from "@/lib/services/attendance";
import { PERMISSIONS } from "@/lib/permissions";
import { makeSchool } from "../performance/helpers";
import { cleanupTestSchools } from "../helpers/factories";

afterAll(cleanupTestSchools);

// This is the exact access decision src/app/dashboard/attendance/page.tsx
// (the class picker) and actions.ts (markAttendanceAction's server-side
// re-check) both call — a teacher must only be able to see and mark
// attendance for a class they have a TeacherAssignment row for.
describe("Attendance — a teacher is scoped to their assigned class only", () => {
  it("a teacher can access their assigned class arm but not a different one in the same school", async () => {
    const { school, teacher, teacherPerms, armA, armB } = await makeSchool("attendance");
    const perms = new Set<string>([...teacherPerms, PERMISSIONS.ATTENDANCE_MARK]);

    const access = await getAccessibleClassArmIds(school.id, teacher.id, perms);
    expect(access).not.toBe("ALL");
    expect(canAccessClassArm(access, armA.id)).toBe(true);
    expect(canAccessClassArm(access, armB.id)).toBe(false);
  });

  it("an admin with ACADEMICS_MANAGE can access every class arm in the school", async () => {
    const { school, admin, adminPerms, armA, armB } = await makeSchool("attendance");

    const access = await getAccessibleClassArmIds(school.id, admin.id, adminPerms);
    expect(access).toBe("ALL");
    expect(canAccessClassArm(access, armA.id)).toBe(true);
    expect(canAccessClassArm(access, armB.id)).toBe(true);
  });

  it("a teacher with no TeacherAssignment at all can access no class arm", async () => {
    const { school, teacher, armA, armB } = await makeSchool("attendance");
    // A second teacher sharing the same TEACHER role row (one role per
    // (schoolId, key) — many users can hold it) but with no
    // TeacherAssignment of their own.
    const otherTeacher = await prisma.user.create({
      data: { schoolId: school.id, roleId: teacher.roleId, email: `other-${Date.now()}@vitest.local`, passwordHash: "x", name: "Other Teacher" },
    });
    const perms = new Set([PERMISSIONS.ATTENDANCE_VIEW, PERMISSIONS.ATTENDANCE_MARK]);

    const access = await getAccessibleClassArmIds(school.id, otherTeacher.id, perms);
    expect(canAccessClassArm(access, armA.id)).toBe(false);
    expect(canAccessClassArm(access, armB.id)).toBe(false);
  });

  it("markAttendance itself still works normally once a caller has confirmed access (the scoping decision, not the write path, is what changed)", async () => {
    const { school, teacher, armA } = await makeSchool("attendance");
    const student = await prisma.student.create({
      data: { schoolId: school.id, admissionNumber: `ATT-${Date.now()}`, firstName: "A", lastName: "B", classArmId: armA.id, status: "ACTIVE" },
    });

    await markAttendance(school.id, teacher.id, {
      classArmId: armA.id,
      date: new Date().toISOString().slice(0, 10),
      entries: [{ studentId: student.id, status: "PRESENT" }],
    });

    const record = await prisma.attendanceRecord.findFirst({ where: { schoolId: school.id, studentId: student.id } });
    expect(record?.status).toBe("PRESENT");
  });
});
