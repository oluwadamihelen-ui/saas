import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { saveScores } from "@/lib/services/results";
import { updateStudent } from "@/lib/services/students";
import { markAttendance } from "@/lib/services/attendance";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getStudentPerformanceAnalysis,
  getClassPerformanceOverview,
  getSchoolPerformanceOverview,
} from "@/lib/services/performance/analysis";
import { PerformanceAccessDeniedError } from "@/lib/services/performance/authorization";
import { cleanupTestSchools } from "../helpers/factories";

afterAll(cleanupTestSchools);

let counter = 0;
async function makeSchool(namePrefix: string) {
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

describe("TEST 8 — historical class correctness", () => {
  it("uses Score.classArmId (the student's real class when the score was recorded), never Student.classArmId, for a promoted student's past-term analysis", async () => {
    const f = await makeSchool("hist");
    const student = await prisma.student.create({
      data: { schoolId: f.school.id, firstName: "Promo", lastName: "Student", admissionNumber: "P1", status: "ACTIVE", classArmId: f.armA.id },
    });

    // Term 1: scored while in JSS2A.
    await saveScores(f.school.id, f.admin.id, {
      subjectId: f.mathSubject.id,
      termId: f.term1.id,
      classArmId: f.armA.id,
      entries: [{ studentId: student.id, componentId: f.component.id, value: 80 }],
    });

    // Student is promoted/transferred to JSS2B; Student.classArmId now points at B.
    await updateStudent(f.school.id, student.id, { classArmId: f.armB.id });

    const analysis = await getStudentPerformanceAnalysis(f.school.id, f.admin.id, f.adminPerms, student.id, f.term1.id);
    expect(analysis.metrics.classArmId).toBe(f.armA.id); // the verified historical class, not Student.classArmId (B)
  });
});

describe("TEST 9 — multi-school isolation", () => {
  it("rejects analyzing a student who belongs to a different school", async () => {
    const schoolA = await makeSchool("a");
    const schoolB = await makeSchool("b");
    const studentB = await prisma.student.create({
      data: { schoolId: schoolB.school.id, firstName: "Other", lastName: "School", admissionNumber: "B1", status: "ACTIVE", classArmId: schoolB.armA.id },
    });

    await expect(
      getStudentPerformanceAnalysis(schoolA.school.id, schoolA.admin.id, schoolA.adminPerms, studentB.id, schoolA.term1.id)
    ).rejects.toThrow("Student not found");
  });
});

describe("TEST 10 — teacher class-scoping", () => {
  it("allows a teacher to analyze a student in a class they're assigned to", async () => {
    const f = await makeSchool("teachok");
    const student = await prisma.student.create({
      data: { schoolId: f.school.id, firstName: "In", lastName: "MyClass", admissionNumber: "S1", status: "ACTIVE", classArmId: f.armA.id },
    });
    await saveScores(f.school.id, f.teacher.id, {
      subjectId: f.mathSubject.id,
      termId: f.term2.id,
      classArmId: f.armA.id,
      entries: [{ studentId: student.id, componentId: f.component.id, value: 70 }],
    });

    const analysis = await getStudentPerformanceAnalysis(f.school.id, f.teacher.id, f.teacherPerms, student.id, f.term2.id);
    expect(analysis.metrics.overallAverage).toBe(70);
  });

  it("rejects a teacher analyzing a student in a class they are NOT assigned to", async () => {
    const f = await makeSchool("teachno");
    const student = await prisma.student.create({
      data: { schoolId: f.school.id, firstName: "Not", lastName: "MyClass", admissionNumber: "S2", status: "ACTIVE", classArmId: f.armB.id },
    });
    await saveScores(f.school.id, f.admin.id, {
      subjectId: f.mathSubject.id,
      termId: f.term2.id,
      classArmId: f.armB.id,
      entries: [{ studentId: student.id, componentId: f.component.id, value: 70 }],
    });

    // f.teacher is only assigned to armA, not armB.
    await expect(getStudentPerformanceAnalysis(f.school.id, f.teacher.id, f.teacherPerms, student.id, f.term2.id)).rejects.toThrow(
      PerformanceAccessDeniedError
    );
  });

  it("rejects a teacher's class-level overview for a class they don't teach, but allows their own", async () => {
    const f = await makeSchool("classscope");
    await expect(getClassPerformanceOverview(f.school.id, f.teacher.id, f.teacherPerms, f.armB.id)).rejects.toThrow(PerformanceAccessDeniedError);
    const overview = await getClassPerformanceOverview(f.school.id, f.teacher.id, f.teacherPerms, f.armA.id, f.term2.id);
    expect(overview.classArmId).toBe(f.armA.id);
  });

  it("rejects a teacher's school-wide overview entirely, even with results.view", async () => {
    const f = await makeSchool("schoolscope");
    await expect(getSchoolPerformanceOverview(f.school.id, f.teacher.id, f.teacherPerms, f.term2.id)).rejects.toThrow(PerformanceAccessDeniedError);
    const overview = await getSchoolPerformanceOverview(f.school.id, f.admin.id, f.adminPerms, f.term2.id);
    expect(overview.termId).toBe(f.term2.id);
  });
});

describe("Cross-session comparison periods", () => {
  it("resolves the previous term chronologically across an academic session boundary", async () => {
    const f = await makeSchool("crosssession");
    const session2 = await prisma.academicSession.create({
      data: { schoolId: f.school.id, name: "2026/2027", startDate: new Date("2026-09-01"), endDate: new Date("2027-07-31") },
    });
    const term3 = await prisma.term.create({
      data: { schoolId: f.school.id, academicSessionId: session2.id, name: "First Term", startDate: new Date("2026-09-01"), endDate: new Date("2026-12-15") },
    });

    const student = await prisma.student.create({
      data: { schoolId: f.school.id, firstName: "Cross", lastName: "Session", admissionNumber: "CS1", status: "ACTIVE", classArmId: f.armA.id },
    });

    await saveScores(f.school.id, f.admin.id, {
      subjectId: f.mathSubject.id,
      termId: f.term2.id, // 2025/2026 Second Term — the real predecessor of the new session's First Term
      classArmId: f.armA.id,
      entries: [{ studentId: student.id, componentId: f.component.id, value: 60 }],
    });
    await saveScores(f.school.id, f.admin.id, {
      subjectId: f.mathSubject.id,
      termId: term3.id,
      classArmId: f.armA.id,
      entries: [{ studentId: student.id, componentId: f.component.id, value: 85 }],
    });

    const analysis = await getStudentPerformanceAnalysis(f.school.id, f.admin.id, f.adminPerms, student.id, term3.id);
    expect(analysis.trend.status).toBe("IMPROVING");
    expect(analysis.trend.previous?.period.termId).toBe(f.term2.id);
    expect(analysis.trend.changePoints).toBe(25);
  });
});

describe("Attendance is term-scoped and missing data is handled honestly", () => {
  it("computes attendance only from the target term's records and reports insufficient data for a term with none", async () => {
    const f = await makeSchool("attend");
    const student = await prisma.student.create({
      data: { schoolId: f.school.id, firstName: "Att", lastName: "Endance", admissionNumber: "A1", status: "ACTIVE", classArmId: f.armA.id },
    });

    // markAttendance always writes against the school's isCurrent term —
    // f.term2 is isCurrent: true in makeSchool's fixture, matching that.
    await markAttendance(f.school.id, f.admin.id, {
      classArmId: f.armA.id,
      date: "2026-01-10",
      entries: [{ studentId: student.id, status: "ABSENT" }],
    });

    const withData = await getStudentPerformanceAnalysis(f.school.id, f.admin.id, f.adminPerms, student.id, f.term2.id);
    expect(withData.attendance.availability).toBe("AVAILABLE");
    expect(withData.attendance.daysAbsent).toBe(1);

    const withoutData = await getStudentPerformanceAnalysis(f.school.id, f.admin.id, f.adminPerms, student.id, f.term1.id);
    expect(withoutData.attendance.availability).toBe("INSUFFICIENT_DATA");
    expect(withoutData.risk.reasons.some((r) => r.toLowerCase().includes("attendance"))).toBe(false);
  });
});
