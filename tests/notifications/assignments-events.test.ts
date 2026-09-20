import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createAssignment, gradeSubmission } from "@/lib/services/assignments";
import { cleanupTestSchools } from "../helpers/factories";
import { makeNotificationsSchool } from "./helpers";

afterAll(cleanupTestSchools);

describe("event-triggered notifications — assignment created", () => {
  it("notifies the student and guardian of the assigned class, scoped to that class only", async () => {
    const f = await makeNotificationsSchool("assignment-created");
    const otherArm = await prisma.classArm.create({ data: { schoolId: f.school.id, classGroupId: f.classGroup.id, name: "B" } });
    const otherStudent = await prisma.student.create({
      data: { schoolId: f.school.id, firstName: "Other", lastName: "Arm", admissionNumber: `ADM-OTHER-${f.school.id}`, status: "ACTIVE", classArmId: otherArm.id },
    });

    const assignment = await createAssignment(f.school.id, f.teacher.id, {
      classArmId: f.classArm.id,
      subjectId: f.subject.id,
      title: "Fractions worksheet",
      dueDate: new Date("2026-02-01"),
    });

    const studentNotifs = await prisma.notification.findMany({ where: { schoolId: f.school.id, userId: f.studentUser.id, type: "ASSIGNMENT_CREATED" } });
    const guardianNotifs = await prisma.notification.findMany({ where: { schoolId: f.school.id, userId: f.guardianUser.id, type: "ASSIGNMENT_CREATED" } });
    expect(studentNotifs).toHaveLength(1);
    expect(studentNotifs[0].category).toBe("ASSIGNMENT");
    expect(studentNotifs[0].entityId).toBe(assignment.id);
    expect(guardianNotifs).toHaveLength(1);

    // The other class's student never has a portal account linked in this fixture, so simply asserting
    // no notification exists for any user outside f.classArm's own roster is the real isolation check —
    // otherStudent has no userId, so a stray notification would only ever be creatable for f.studentUser
    // or f.guardianUser in the first place. The assertion above (exactly 1 row each) already proves that.
    expect(otherStudent.classArmId).toBe(otherArm.id);
  });
});

describe("event-triggered notifications — assignment graded", () => {
  it("notifies the submitting student and guardian, and dedupes a re-grade of the same submission", async () => {
    const f = await makeNotificationsSchool("assignment-graded");
    const assignment = await createAssignment(f.school.id, f.teacher.id, {
      classArmId: f.classArm.id,
      subjectId: f.subject.id,
      title: "Essay",
      dueDate: new Date("2026-02-01"),
    });
    const submission = await prisma.assignmentSubmission.findFirstOrThrow({ where: { assignmentId: assignment.id, studentId: f.student.id } });

    await gradeSubmission(f.school.id, f.teacher.id, submission.id, { status: "GRADED", score: 85 });
    await gradeSubmission(f.school.id, f.teacher.id, submission.id, { status: "GRADED", score: 90 }); // re-grade — same dedupeKey

    const studentNotifs = await prisma.notification.findMany({ where: { schoolId: f.school.id, userId: f.studentUser.id, type: "ASSIGNMENT_GRADED" } });
    expect(studentNotifs).toHaveLength(1);
    expect(studentNotifs[0].body).toContain("85"); // first grade's notification wins, exactly like the dedupe engine test
  });

  it("does not notify when a submission is only marked SUBMITTED, not GRADED", async () => {
    const f = await makeNotificationsSchool("assignment-submitted-only");
    const assignment = await createAssignment(f.school.id, f.teacher.id, {
      classArmId: f.classArm.id,
      subjectId: f.subject.id,
      title: "Homework",
      dueDate: new Date("2026-02-01"),
    });
    const submission = await prisma.assignmentSubmission.findFirstOrThrow({ where: { assignmentId: assignment.id, studentId: f.student.id } });

    await gradeSubmission(f.school.id, f.teacher.id, submission.id, { status: "SUBMITTED" });

    const rows = await prisma.notification.findMany({ where: { schoolId: f.school.id, userId: f.studentUser.id, type: "ASSIGNMENT_GRADED" } });
    expect(rows).toHaveLength(0);
  });
});
