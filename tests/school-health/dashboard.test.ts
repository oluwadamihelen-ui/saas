import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { saveScores } from "@/lib/services/results";
import { markAttendance } from "@/lib/services/attendance";
import { PERMISSIONS } from "@/lib/permissions";
import { getSchoolHealthDashboard, SchoolHealthAccessDeniedError } from "@/lib/services/school-health/analysis";
import { cleanupTestSchools } from "../helpers/factories";

afterAll(cleanupTestSchools);

let counter = 0;
async function makeSchool(namePrefix: string, opts: { withTerm?: boolean } = { withTerm: true }) {
  counter += 1;
  const slug = `vitest-shd-${namePrefix}-${Date.now()}-${counter}`;
  const school = await prisma.school.create({ data: { name: slug, slug, status: "ACTIVE" } });

  const adminRole = await prisma.role.create({ data: { schoolId: school.id, key: "SCHOOL_ADMIN", name: "School Administrator" } });
  const teacherRole = await prisma.role.create({ data: { schoolId: school.id, key: "TEACHER", name: "Teacher" } });
  const parentRole = await prisma.role.create({ data: { schoolId: school.id, key: "PARENT", name: "Parent" } });

  const admin = await prisma.user.create({
    data: { schoolId: school.id, roleId: adminRole.id, email: `admin-${slug}@vitest.local`, passwordHash: "x", name: "Admin", status: "ACTIVE" },
  });
  const teacher = await prisma.user.create({
    data: { schoolId: school.id, roleId: teacherRole.id, email: `teacher-${slug}@vitest.local`, passwordHash: "x", name: "Teacher", status: "ACTIVE" },
  });
  // A portal (parent) login — must never be counted as staff.
  await prisma.user.create({
    data: { schoolId: school.id, roleId: parentRole.id, email: `parent-${slug}@vitest.local`, passwordHash: "x", name: "Parent", status: "ACTIVE" },
  });

  const adminPerms = new Set([PERMISSIONS.ACADEMICS_MANAGE, PERMISSIONS.FINANCE_VIEW]);
  const teacherPerms = new Set([PERMISSIONS.RESULTS_VIEW, PERMISSIONS.FINANCE_VIEW]); // has finance.view but NOT academics.manage

  let session, term, mathSubject, component, classGroup, classArm;
  if (opts.withTerm) {
    session = await prisma.academicSession.create({
      data: { schoolId: school.id, name: "2025/2026", startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true },
    });
    term = await prisma.term.create({
      data: { schoolId: school.id, academicSessionId: session.id, name: "First Term", startDate: new Date("2025-09-01"), endDate: new Date("2025-12-15"), isCurrent: true },
    });
    mathSubject = await prisma.subject.create({ data: { schoolId: school.id, name: "Mathematics", code: "MTH" } });
    component = await prisma.assessmentComponent.create({ data: { schoolId: school.id, name: "Exam", maxScore: 100, order: 0 } });
    classGroup = await prisma.classGroup.create({ data: { schoolId: school.id, name: "JSS 2", order: 1 } });
    classArm = await prisma.classArm.create({ data: { schoolId: school.id, classGroupId: classGroup.id, name: "A" } });
  }

  return { school, admin, teacher, adminPerms, teacherPerms, session, term, mathSubject, component, classGroup, classArm };
}

describe("TEST 7 — permission denial", () => {
  it("rejects a user missing academics.manage even with finance.view", async () => {
    const f = await makeSchool("permteacher");
    await expect(getSchoolHealthDashboard(f.school.id, f.teacher.id, f.teacherPerms, f.term!.id)).rejects.toThrow(SchoolHealthAccessDeniedError);
  });

  it("rejects a user missing finance.view even with academics.manage", async () => {
    const f = await makeSchool("permnofinance");
    const perms = new Set([PERMISSIONS.ACADEMICS_MANAGE]);
    await expect(getSchoolHealthDashboard(f.school.id, f.admin.id, perms, f.term!.id)).rejects.toThrow(SchoolHealthAccessDeniedError);
  });

  it("allows a user with both permissions", async () => {
    const f = await makeSchool("permok");
    const dashboard = await getSchoolHealthDashboard(f.school.id, f.admin.id, f.adminPerms, f.term!.id);
    expect(dashboard.period?.termId).toBe(f.term!.id);
  });
});

describe("TEST 6 — multi-school isolation", () => {
  it("a term from another school is never resolved — falls back to the graceful no-term state, not the other school's data", async () => {
    const schoolA = await makeSchool("isoA");
    const schoolB = await makeSchool("isoB");

    const dashboard = await getSchoolHealthDashboard(schoolA.school.id, schoolA.admin.id, schoolA.adminPerms, schoolB.term!.id);
    expect(dashboard.period).toBeNull(); // schoolB's termId doesn't exist for schoolA
  });

  it("staff counts never cross schools", async () => {
    const schoolA = await makeSchool("staffA");
    const schoolB = await makeSchool("staffB");

    const dashboardA = await getSchoolHealthDashboard(schoolA.school.id, schoolA.admin.id, schoolA.adminPerms, schoolA.term!.id);
    // Each fixture school has exactly 2 staff (admin + teacher), never counting the other school's users.
    expect(dashboardA.staff.totalActiveStaff).toBe(2);
    void schoolB;
  });
});

describe("Correct staff counting excludes portal roles", () => {
  it("does not count PARENT-role users as staff", async () => {
    const f = await makeSchool("staffcount");
    const dashboard = await getSchoolHealthDashboard(f.school.id, f.admin.id, f.adminPerms, f.term!.id);
    // 2 real staff (admin, teacher); the PARENT-role user created in the fixture must be excluded.
    expect(dashboard.staff.totalActiveStaff).toBe(2);
  });
});

describe("TEST 8/9 — no active session/term", () => {
  it("returns a graceful empty state, never a crash", async () => {
    const f = await makeSchool("noterm", { withTerm: false });
    const dashboard = await getSchoolHealthDashboard(f.school.id, f.admin.id, f.adminPerms);
    expect(dashboard.period).toBeNull();
    expect(dashboard.academic.availability).toBe("INSUFFICIENT_DATA");
    expect(dashboard.healthScore.completeness).toBe("NO_DATA");
    expect(dashboard.actionItems).toEqual([]);
  });
});

describe("TEST 2/3/4 — missing component data is never treated as poor performance", () => {
  it("Financial Health is INSUFFICIENT_DATA (not 0%) when no invoices exist, even with academic data present", async () => {
    const f = await makeSchool("nofinance");
    const student = await prisma.student.create({
      data: { schoolId: f.school.id, firstName: "A", lastName: "B", admissionNumber: "S1", status: "ACTIVE", classArmId: f.classArm!.id },
    });
    await saveScores(f.school.id, f.admin.id, {
      subjectId: f.mathSubject!.id,
      termId: f.term!.id,
      classArmId: f.classArm!.id,
      entries: [{ studentId: student.id, componentId: f.component!.id, value: 80 }],
    });

    const dashboard = await getSchoolHealthDashboard(f.school.id, f.admin.id, f.adminPerms, f.term!.id);
    expect(dashboard.academic.availability).toBe("AVAILABLE");
    expect(dashboard.financial.availability).toBe("INSUFFICIENT_DATA");
    expect(dashboard.financial.score).toBeNull();
    // Financial excluded from the score, not counted as zero.
    const financialComponent = dashboard.healthScore.components.find((c) => c.key === "financial")!;
    expect(financialComponent.normalizedWeight).toBeNull();
  });

  it("Academic Health is INSUFFICIENT_DATA (not 0%) when no scores exist yet this term", async () => {
    const f = await makeSchool("noacademic");
    const dashboard = await getSchoolHealthDashboard(f.school.id, f.admin.id, f.adminPerms, f.term!.id);
    expect(dashboard.academic.availability).toBe("INSUFFICIENT_DATA");
    expect(dashboard.academic.score).toBeNull();
  });

  it("Attendance Health is INSUFFICIENT_DATA when no attendance has been recorded", async () => {
    const f = await makeSchool("noattendance");
    const dashboard = await getSchoolHealthDashboard(f.school.id, f.admin.id, f.adminPerms, f.term!.id);
    expect(dashboard.attendance.availability).toBe("INSUFFICIENT_DATA");
    expect(dashboard.attendance.score).toBeNull();
  });
});

describe("Attendance completion never assumes absence", () => {
  it("today's attendance completion reflects real recorded classes only, and pending classes are shown honestly", async () => {
    const f = await makeSchool("completion");
    const student = await prisma.student.create({
      data: { schoolId: f.school.id, firstName: "C", lastName: "D", admissionNumber: "S2", status: "ACTIVE", classArmId: f.classArm!.id },
    });
    const dashboardBefore = await getSchoolHealthDashboard(f.school.id, f.admin.id, f.adminPerms, f.term!.id);
    expect(dashboardBefore.operational.attendanceCompletionToday.classesCompleted).toBe(0);
    expect(dashboardBefore.operational.attendanceCompletionToday.classesTotal).toBe(1);

    await markAttendance(f.school.id, f.admin.id, {
      classArmId: f.classArm!.id,
      date: new Date().toISOString().slice(0, 10),
      entries: [{ studentId: student.id, status: "PRESENT" }],
    });

    const dashboardAfter = await getSchoolHealthDashboard(f.school.id, f.admin.id, f.adminPerms, f.term!.id);
    expect(dashboardAfter.operational.attendanceCompletionToday.classesCompleted).toBe(1);
    expect(dashboardAfter.operational.attendanceCompletionToday.ratePercent).toBe(100);
  });
});
