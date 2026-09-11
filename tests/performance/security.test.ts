import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { saveScores } from "@/lib/services/results";
import {
  getClassPerformanceOverview,
  getSchoolPerformanceOverview,
} from "@/lib/services/performance/analysis";
import { getSubjectPerformanceIntelligence } from "@/lib/services/performance/subject-intelligence";
import { PerformanceAccessDeniedError } from "@/lib/services/performance/authorization";
import { cleanupTestSchools } from "../helpers/factories";
import { makeSchool } from "./helpers";

afterAll(cleanupTestSchools);

describe("TEST 9 (extended) — multi-school isolation at every entry point", () => {
  it("rejects a class-level overview for a class that belongs to a different school", async () => {
    const schoolA = await makeSchool("classisoA");
    const schoolB = await makeSchool("classisoB");

    // schoolA's admin holds academics.manage (ALL access) within their
    // OWN school, so the access-scope check alone doesn't reject this —
    // the classArm lookup itself is schoolId-scoped and correctly finds
    // nothing, the same "cross-school = not found, not merely denied"
    // pattern already used for a cross-school student (see analysis.test.ts's
    // TEST 9: "Student not found", not a PerformanceAccessDeniedError).
    await expect(
      getClassPerformanceOverview(schoolA.school.id, schoolA.admin.id, schoolA.adminPerms, schoolB.armA.id)
    ).rejects.toThrow("Class not found");
  });

  it("never includes another school's students in a school-wide overview", async () => {
    const schoolA = await makeSchool("schoolisoA");
    const schoolB = await makeSchool("schoolisoB");

    await prisma.student.create({
      data: { schoolId: schoolA.school.id, firstName: "OnlyIn", lastName: "SchoolA", admissionNumber: "A1", status: "ACTIVE", classArmId: schoolA.armA.id },
    });
    await prisma.student.create({
      data: { schoolId: schoolB.school.id, firstName: "OnlyIn", lastName: "SchoolB", admissionNumber: "B1", status: "ACTIVE", classArmId: schoolB.armA.id },
    });

    const overviewA = await getSchoolPerformanceOverview(schoolA.school.id, schoolA.admin.id, schoolA.adminPerms, schoolA.term1.id);
    expect(overviewA.allStudents.some((s) => s.studentName === "OnlyIn SchoolB")).toBe(false);
    expect(overviewA.studentsAnalyzed).toBe(1);
  });

  it("rejects subject performance intelligence for a subject that belongs to a different school", async () => {
    const schoolA = await makeSchool("subjisoA");
    const schoolB = await makeSchool("subjisoB");

    await expect(
      getSubjectPerformanceIntelligence(schoolA.school.id, schoolA.admin.id, schoolA.adminPerms, schoolB.mathSubject.id, schoolA.term1.id)
    ).rejects.toThrow("Subject not found.");
  });

  it("rejects subject performance intelligence entirely for a teacher, even within their own school", async () => {
    const f = await makeSchool("subjteacher");
    await expect(
      getSubjectPerformanceIntelligence(f.school.id, f.teacher.id, f.teacherPerms, f.mathSubject.id, f.term1.id)
    ).rejects.toThrow(PerformanceAccessDeniedError);
  });
});

describe("TEST 10 (extended) — a custom role with results.view alone is not enough", () => {
  it("rejects a user who holds results.view/attendance.view but has neither academics.manage nor any TeacherAssignment row", async () => {
    const f = await makeSchool("noassign");
    const unassignedRole = await prisma.role.create({ data: { schoolId: f.school.id, key: "ACCOUNTANT", name: "Accountant" } });
    const unassignedUser = await prisma.user.create({
      data: { schoolId: f.school.id, roleId: unassignedRole.id, email: `unassigned-${Date.now()}@vitest.local`, passwordHash: "x", name: "No Assignment" },
    });
    const student = await prisma.student.create({
      data: { schoolId: f.school.id, firstName: "Some", lastName: "Student", admissionNumber: "NA1", status: "ACTIVE", classArmId: f.armA.id },
    });
    await saveScores(f.school.id, f.admin.id, {
      subjectId: f.mathSubject.id,
      termId: f.term1.id,
      classArmId: f.armA.id,
      entries: [{ studentId: student.id, componentId: f.component.id, value: 70 }],
    });

    const perms = new Set<string>(["results.view", "attendance.view"]);

    await expect(getClassPerformanceOverview(f.school.id, unassignedUser.id, perms, f.armA.id, f.term1.id)).rejects.toThrow(
      PerformanceAccessDeniedError
    );
  });
});

describe("Class arm not found is distinguished from access denied", () => {
  it("reports 'Class not found' for a genuinely nonexistent classArmId within the same school", async () => {
    const f = await makeSchool("notfound");
    await expect(getClassPerformanceOverview(f.school.id, f.admin.id, f.adminPerms, "does-not-exist", f.term1.id)).rejects.toThrow(
      "Class not found"
    );
  });
});
