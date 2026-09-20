import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { maybeRunNotificationRules } from "@/lib/services/notification-rules";
import { schoolLocalToday } from "@/lib/services/birthdays";
import { cleanupTestSchools } from "../helpers/factories";
import { makeNotificationsSchool } from "./helpers";

afterAll(cleanupTestSchools);

describe("notification rules — admin action items", () => {
  it("notifies the admin (holding academics.manage + finance.view) but not the teacher", async () => {
    const f = await makeNotificationsSchool("admin-actions");

    // Outstanding fees -> a financial action item worth notifying about.
    const feeCategory = await prisma.feeCategory.create({ data: { schoolId: f.school.id, name: "Tuition" } });
    const feeStructure = await prisma.feeStructure.create({
      data: { schoolId: f.school.id, categoryId: feeCategory.id, termId: f.term.id, name: "Tuition", amountMinor: 1000000 },
    });
    await prisma.invoice.create({
      data: {
        schoolId: f.school.id,
        studentId: f.student.id,
        termId: f.term.id,
        invoiceNumber: `INV-${f.school.id}`,
        subtotalMinor: 1000000,
        totalMinor: 1000000,
        dueDate: new Date("2026-03-01"),
        payToken: `tok-${f.school.id}`,
        items: { create: [{ feeStructureId: feeStructure.id, description: "Tuition", amountMinor: 1000000 }] },
      },
    });

    await maybeRunNotificationRules(f.school.id);

    const adminNotifs = await prisma.notification.findMany({ where: { schoolId: f.school.id, userId: f.admin.id, type: "ADMIN_ACTION_ITEM" } });
    const teacherNotifs = await prisma.notification.findMany({ where: { schoolId: f.school.id, userId: f.teacher.id, type: "ADMIN_ACTION_ITEM" } });
    expect(adminNotifs.length).toBeGreaterThan(0);
    expect(teacherNotifs).toHaveLength(0);
  });
});

describe("notification rules — birthdays digest", () => {
  it("notifies a birthdays.view holder with one digest row, not one per person, and dedupes on a second run", async () => {
    const f = await makeNotificationsSchool("birthdays");
    // maybeRunNotificationRules always uses the real current time internally
    // (it's the lazy, page-load-triggered trigger — not something a test
    // can inject a fake "now" into), so the birthday must be set to
    // whatever "today" actually is in the school's own timezone right now.
    const today = schoolLocalToday("Africa/Lagos");
    await prisma.student.update({ where: { id: f.student.id }, data: { dateOfBirth: new Date(Date.UTC(2015, today.month - 1, today.day)) } });

    await maybeRunNotificationRules(f.school.id);
    // Force a second scan past the throttle window to verify dedup, not just the throttle itself.
    await prisma.school.update({ where: { id: f.school.id }, data: { notificationRulesLastRunAt: new Date(Date.now() - 20 * 60 * 1000) } });
    await maybeRunNotificationRules(f.school.id);

    const rows = await prisma.notification.findMany({ where: { schoolId: f.school.id, userId: f.admin.id, type: "BIRTHDAY_UPCOMING" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].title.toLowerCase()).toContain("birthday");
  });
});

describe("notification rules — teacher rules", () => {
  it("notifies only the assigned teacher about their own pending grading and missing scores", async () => {
    const f = await makeNotificationsSchool("teacher-rules");
    const teacherRole = await prisma.role.findFirstOrThrow({ where: { schoolId: f.school.id, key: "TEACHER" } });
    const otherTeacher = await prisma.user.create({
      data: { schoolId: f.school.id, roleId: teacherRole.id, email: `t2-${f.school.id}@vitest.local`, passwordHash: "x", name: "Teacher 2", status: "ACTIVE" },
    });

    const assignment = await prisma.assignment.create({
      data: {
        schoolId: f.school.id,
        classArmId: f.classArm.id,
        subjectId: f.subject.id,
        teacherId: f.teacher.id,
        termId: f.term.id,
        title: "Algebra homework",
        dueDate: new Date("2026-02-01"),
      },
    });
    await prisma.assignmentSubmission.create({ data: { assignmentId: assignment.id, studentId: f.student.id, status: "SUBMITTED" } });

    await maybeRunNotificationRules(f.school.id);

    const teacherGrading = await prisma.notification.findMany({ where: { schoolId: f.school.id, userId: f.teacher.id, type: "ASSIGNMENT_GRADING_PENDING" } });
    const otherGrading = await prisma.notification.findMany({ where: { schoolId: f.school.id, userId: otherTeacher.id, type: "ASSIGNMENT_GRADING_PENDING" } });
    expect(teacherGrading).toHaveLength(1);
    expect(otherGrading).toHaveLength(0);

    const teacherScores = await prisma.notification.findMany({ where: { schoolId: f.school.id, userId: f.teacher.id, type: "TEACHER_SCORES_PENDING" } });
    expect(teacherScores).toHaveLength(1); // no Score rows exist yet for this teacher's subject+class this term
  });
});

describe("notification rules — parent rules (strict per-child scoping)", () => {
  it("notifies only the correct guardian about their own child's outstanding fees, never a school-wide figure", async () => {
    const f = await makeNotificationsSchool("parent-fees");

    // A second, unrelated family with a fully-paid invoice — must never see or trigger anything.
    const otherGuardianRole = await prisma.role.upsert({
      where: { schoolId_key: { schoolId: f.school.id, key: "PARENT" } },
      create: { schoolId: f.school.id, key: "PARENT", name: "Parent" },
      update: {},
    });
    const otherGuardianUser = await prisma.user.create({
      data: { schoolId: f.school.id, roleId: otherGuardianRole.id, email: `parent2-${f.school.id}@vitest.local`, passwordHash: "x", name: "Parent 2", status: "ACTIVE" },
    });
    const otherGuardian = await prisma.guardian.create({ data: { schoolId: f.school.id, firstName: "Parent", lastName: "Two", phone: "0800000001", userId: otherGuardianUser.id } });
    const otherStudent = await prisma.student.create({
      data: { schoolId: f.school.id, firstName: "Other", lastName: "Child", admissionNumber: `ADM2-${f.school.id}`, status: "ACTIVE", classArmId: f.classArm.id },
    });
    await prisma.studentGuardian.create({ data: { studentId: otherStudent.id, guardianId: otherGuardian.id, relationship: "FATHER", isPrimary: true } });

    const feeCategory = await prisma.feeCategory.create({ data: { schoolId: f.school.id, name: "Tuition" } });
    const feeStructure = await prisma.feeStructure.create({
      data: { schoolId: f.school.id, categoryId: feeCategory.id, termId: f.term.id, name: "Tuition", amountMinor: 500000 },
    });

    // f.student: unpaid invoice (outstanding).
    await prisma.invoice.create({
      data: {
        schoolId: f.school.id, studentId: f.student.id, termId: f.term.id, invoiceNumber: `INV-A-${f.school.id}`,
        subtotalMinor: 500000, totalMinor: 500000, dueDate: new Date("2026-03-01"), payToken: `tok-a-${f.school.id}`,
        items: { create: [{ feeStructureId: feeStructure.id, description: "Tuition", amountMinor: 500000 }] },
      },
    });
    // otherStudent: fully paid invoice — no outstanding balance.
    const paidInvoice = await prisma.invoice.create({
      data: {
        schoolId: f.school.id, studentId: otherStudent.id, termId: f.term.id, invoiceNumber: `INV-B-${f.school.id}`,
        subtotalMinor: 500000, totalMinor: 500000, dueDate: new Date("2026-03-01"), payToken: `tok-b-${f.school.id}`,
        items: { create: [{ feeStructureId: feeStructure.id, description: "Tuition", amountMinor: 500000 }] },
      },
    });
    await prisma.payment.create({
      data: { schoolId: f.school.id, invoiceId: paidInvoice.id, amountMinor: 500000, method: "MANUAL", status: "CONFIRMED", reference: `pay-${f.school.id}`, paidAt: new Date("2026-01-15") },
    });

    await maybeRunNotificationRules(f.school.id);

    const correctGuardianNotifs = await prisma.notification.findMany({ where: { schoolId: f.school.id, userId: f.guardianUser.id, type: "FEES_OUTSTANDING" } });
    const otherGuardianNotifs = await prisma.notification.findMany({ where: { schoolId: f.school.id, userId: otherGuardianUser.id, type: "FEES_OUTSTANDING" } });

    expect(correctGuardianNotifs).toHaveLength(1);
    expect(correctGuardianNotifs[0].body).toContain("Student One");
    expect(correctGuardianNotifs[0].entityId).toBe(f.student.id);
    expect(otherGuardianNotifs).toHaveLength(0); // paid up — never notified
  });

  it("only flags attendance concern once there is enough data, and only to that child's own guardian", async () => {
    const f = await makeNotificationsSchool("parent-attendance");
    await prisma.school.update({ where: { id: f.school.id }, data: { attendanceConcernThreshold: 80 } });

    // 3 absences, 2 present out of 5 records = 40% — below threshold, and exactly at the minimum-records guard.
    await prisma.attendanceRecord.createMany({
      data: [
        { schoolId: f.school.id, studentId: f.student.id, classArmId: f.classArm.id, termId: f.term.id, date: new Date("2026-01-05"), status: "PRESENT", markedById: f.admin.id },
        { schoolId: f.school.id, studentId: f.student.id, classArmId: f.classArm.id, termId: f.term.id, date: new Date("2026-01-06"), status: "PRESENT", markedById: f.admin.id },
        { schoolId: f.school.id, studentId: f.student.id, classArmId: f.classArm.id, termId: f.term.id, date: new Date("2026-01-07"), status: "ABSENT", markedById: f.admin.id },
        { schoolId: f.school.id, studentId: f.student.id, classArmId: f.classArm.id, termId: f.term.id, date: new Date("2026-01-08"), status: "ABSENT", markedById: f.admin.id },
        { schoolId: f.school.id, studentId: f.student.id, classArmId: f.classArm.id, termId: f.term.id, date: new Date("2026-01-09"), status: "ABSENT", markedById: f.admin.id },
      ],
    });

    await maybeRunNotificationRules(f.school.id);

    const rows = await prisma.notification.findMany({ where: { schoolId: f.school.id, userId: f.guardianUser.id, type: "ATTENDANCE_CONCERN" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].body).toContain("40%");
  });

  it("does not flag attendance concern below the minimum-records threshold (avoids over-alerting on sparse data)", async () => {
    const f = await makeNotificationsSchool("parent-attendance-sparse");
    await prisma.school.update({ where: { id: f.school.id }, data: { attendanceConcernThreshold: 80 } });

    // Only 2 records, both absent — would be 0% but too little data to mean anything yet.
    await prisma.attendanceRecord.createMany({
      data: [
        { schoolId: f.school.id, studentId: f.student.id, classArmId: f.classArm.id, termId: f.term.id, date: new Date("2026-01-08"), status: "ABSENT", markedById: f.admin.id },
        { schoolId: f.school.id, studentId: f.student.id, classArmId: f.classArm.id, termId: f.term.id, date: new Date("2026-01-09"), status: "ABSENT", markedById: f.admin.id },
      ],
    });

    await maybeRunNotificationRules(f.school.id);

    const rows = await prisma.notification.findMany({ where: { schoolId: f.school.id, userId: f.guardianUser.id, type: "ATTENDANCE_CONCERN" } });
    expect(rows).toHaveLength(0);
  });
});

describe("notification rules — student rule", () => {
  it("notifies only the student with a pending submission, never a classmate who already submitted", async () => {
    const f = await makeNotificationsSchool("student-due-soon");
    const otherStudent = await prisma.student.create({
      data: { schoolId: f.school.id, firstName: "Already", lastName: "Submitted", admissionNumber: `ADM3-${f.school.id}`, status: "ACTIVE", classArmId: f.classArm.id },
    });
    const otherStudentRole = await prisma.role.upsert({
      where: { schoolId_key: { schoolId: f.school.id, key: "STUDENT" } },
      create: { schoolId: f.school.id, key: "STUDENT", name: "Student" },
      update: {},
    });
    const otherStudentUser = await prisma.user.create({
      data: { schoolId: f.school.id, roleId: otherStudentRole.id, email: `stu2-${f.school.id}@vitest.local`, passwordHash: "x", name: "Already Submitted", status: "ACTIVE" },
    });
    await prisma.student.update({ where: { id: otherStudent.id }, data: { userId: otherStudentUser.id } });

    const dueSoon = new Date(Date.now() + 6 * 60 * 60 * 1000); // 6h from the real "now" the rule engine will use — "due today"
    const assignment = await prisma.assignment.create({
      data: { schoolId: f.school.id, classArmId: f.classArm.id, subjectId: f.subject.id, teacherId: f.teacher.id, termId: f.term.id, title: "Quiz", dueDate: dueSoon },
    });
    await prisma.assignmentSubmission.create({ data: { assignmentId: assignment.id, studentId: f.student.id, status: "PENDING" } });
    await prisma.assignmentSubmission.create({ data: { assignmentId: assignment.id, studentId: otherStudent.id, status: "SUBMITTED" } });

    await maybeRunNotificationRules(f.school.id);

    const pendingStudentNotifs = await prisma.notification.findMany({ where: { schoolId: f.school.id, userId: f.studentUser.id, type: "ASSIGNMENT_DUE_SOON" } });
    const submittedStudentNotifs = await prisma.notification.findMany({ where: { schoolId: f.school.id, userId: otherStudentUser.id, type: "ASSIGNMENT_DUE_SOON" } });
    expect(pendingStudentNotifs).toHaveLength(1);
    expect(pendingStudentNotifs[0].priority).toBe("HIGH"); // due within the "today" window
    expect(submittedStudentNotifs).toHaveLength(0);
  });
});

describe("notification rules — throttle", () => {
  it("a second call within the throttle window does not re-run the scan", async () => {
    const f = await makeNotificationsSchool("throttle");
    await maybeRunNotificationRules(f.school.id);
    const afterFirst = await prisma.school.findUniqueOrThrow({ where: { id: f.school.id }, select: { notificationRulesLastRunAt: true } });
    expect(afterFirst.notificationRulesLastRunAt).not.toBeNull();

    await maybeRunNotificationRules(f.school.id);
    const afterSecond = await prisma.school.findUniqueOrThrow({ where: { id: f.school.id }, select: { notificationRulesLastRunAt: true } });
    expect(afterSecond.notificationRulesLastRunAt!.getTime()).toBe(afterFirst.notificationRulesLastRunAt!.getTime());
  });
});

describe("notification rules — multi-school isolation", () => {
  it("running rules for school A never creates notifications for school B's users", async () => {
    const schoolA = await makeNotificationsSchool("iso-a");
    const schoolB = await makeNotificationsSchool("iso-b");

    const feeCategory = await prisma.feeCategory.create({ data: { schoolId: schoolA.school.id, name: "Tuition" } });
    const feeStructure = await prisma.feeStructure.create({
      data: { schoolId: schoolA.school.id, categoryId: feeCategory.id, termId: schoolA.term.id, name: "Tuition", amountMinor: 200000 },
    });
    await prisma.invoice.create({
      data: {
        schoolId: schoolA.school.id, studentId: schoolA.student.id, termId: schoolA.term.id, invoiceNumber: `INV-ISO-${schoolA.school.id}`,
        subtotalMinor: 200000, totalMinor: 200000, dueDate: new Date("2026-03-01"), payToken: `tok-iso-${schoolA.school.id}`,
        items: { create: [{ feeStructureId: feeStructure.id, description: "Tuition", amountMinor: 200000 }] },
      },
    });

    await maybeRunNotificationRules(schoolA.school.id);

    const leaked = await prisma.notification.findMany({ where: { userId: { in: [schoolB.admin.id, schoolB.guardianUser.id, schoolB.studentUser.id, schoolB.teacher.id] } } });
    expect(leaked).toHaveLength(0);
  });
});
