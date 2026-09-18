import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { saveScores, computeReportCard } from "@/lib/services/results";
import { updateStudent } from "@/lib/services/students";
import { cleanupTestSchools } from "../helpers/factories";

afterAll(cleanupTestSchools);

let counter = 0;
async function makeFixture() {
  counter += 1;
  const slug = `vitest-scoreclasshistory-${Date.now()}-${counter}`;
  const school = await prisma.school.create({ data: { name: slug, slug, status: "ACTIVE" } });
  const role = await prisma.role.create({ data: { schoolId: school.id, key: "TEACHER", name: "Teacher" } });
  const teacher = await prisma.user.create({
    data: { schoolId: school.id, roleId: role.id, email: `${slug}@vitest.local`, passwordHash: "x", name: "Teacher" },
  });
  const session = await prisma.academicSession.create({
    data: { schoolId: school.id, name: "2025/2026", startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true },
  });
  const term = await prisma.term.create({
    data: { schoolId: school.id, academicSessionId: session.id, name: "First Term", startDate: new Date("2025-09-01"), endDate: new Date("2025-12-15"), isCurrent: true },
  });
  const subject = await prisma.subject.create({ data: { schoolId: school.id, name: "Mathematics", code: "MTH" } });
  const component = await prisma.assessmentComponent.create({ data: { schoolId: school.id, name: "Exam", maxScore: 100, order: 0 } });
  const classGroup = await prisma.classGroup.create({ data: { schoolId: school.id, name: "JSS 2", order: 1 } });
  const classArm = await prisma.classArm.create({ data: { schoolId: school.id, classGroupId: classGroup.id, name: "A" } });
  return { school, teacher, session, term, subject, component, classGroup, classArm };
}

describe("saveScores — live score entry carries its class context", () => {
  it("sets classArmId/classArmSource ENTERED on a new score", async () => {
    const { school, teacher, subject, term, component, classArm } = await makeFixture();
    const student = await prisma.student.create({
      data: { schoolId: school.id, firstName: "Ade", lastName: "Bello", admissionNumber: "s1", status: "ACTIVE", classArmId: classArm.id },
    });

    await saveScores(school.id, teacher.id, {
      subjectId: subject.id,
      termId: term.id,
      classArmId: classArm.id,
      entries: [{ studentId: student.id, componentId: component.id, value: 70 }],
    });

    const score = await prisma.score.findUnique({
      where: { studentId_subjectId_termId_componentId: { studentId: student.id, subjectId: subject.id, termId: term.id, componentId: component.id } },
    });
    expect(score?.classArmId).toBe(classArm.id);
    expect(score?.classArmSource).toBe("ENTERED");
  });

  it("does not overwrite classArmId when a score's value is later corrected", async () => {
    const { school, teacher, subject, term, component, classArm, classGroup } = await makeFixture();
    const student = await prisma.student.create({
      data: { schoolId: school.id, firstName: "Ade", lastName: "Bello", admissionNumber: "s1", status: "ACTIVE", classArmId: classArm.id },
    });

    await saveScores(school.id, teacher.id, {
      subjectId: subject.id,
      termId: term.id,
      classArmId: classArm.id,
      entries: [{ studentId: student.id, componentId: component.id, value: 70 }],
    });

    // Student is promoted to a different class...
    const otherArm = await prisma.classArm.create({ data: { schoolId: school.id, classGroupId: classGroup.id, name: "B" } });
    await updateStudent(school.id, student.id, { classArmId: otherArm.id });

    // ...then the SAME term's score is corrected (same subject/term/component -> upsert-update branch).
    await saveScores(school.id, teacher.id, {
      subjectId: subject.id,
      termId: term.id,
      classArmId: otherArm.id, // even if the caller now passes the new class...
      entries: [{ studentId: student.id, componentId: component.id, value: 85 }],
    });

    const score = await prisma.score.findUnique({
      where: { studentId_subjectId_termId_componentId: { studentId: student.id, subjectId: subject.id, termId: term.id, componentId: component.id } },
    });
    expect(score?.value).toBe(85); // value updated
    expect(score?.classArmId).toBe(classArm.id); // class NOT overwritten
  });
});

describe("computeReportCard — historical class averages", () => {
  it("computes the class average from students who actually shared the historical class, not whoever shares the student's current class", async () => {
    const { school, teacher, subject, term, component, classArm: jss2a, classGroup } = await makeFixture();

    const promoted = await prisma.student.create({
      data: { schoolId: school.id, firstName: "Promoted", lastName: "Student", admissionNumber: "p1", status: "ACTIVE", classArmId: jss2a.id },
    });
    const classmate = await prisma.student.create({
      data: { schoolId: school.id, firstName: "Classmate", lastName: "Student", admissionNumber: "c1", status: "ACTIVE", classArmId: jss2a.id },
    });

    // Both scored in JSS2A this term, live entry (source ENTERED).
    await saveScores(school.id, teacher.id, {
      subjectId: subject.id,
      termId: term.id,
      classArmId: jss2a.id,
      entries: [
        { studentId: promoted.id, componentId: component.id, value: 60 },
        { studentId: classmate.id, componentId: component.id, value: 100 },
      ],
    });

    // "promoted" is later moved to a new class. A student who was NEVER
    // in JSS2A moves into it afterward, sharing promoted's OLD class
    // arm id only in the sense that arms get reused — but has no score
    // for this term, so shouldn't affect the average anyway. The real
    // check: a student sharing "promoted"'s CURRENT class must not be
    // pulled into JSS2A's historical average.
    const newArm = await prisma.classArm.create({ data: { schoolId: school.id, classGroupId: classGroup.id, name: "C" } });
    await updateStudent(school.id, promoted.id, { classArmId: newArm.id });

    const currentClassmate = await prisma.student.create({
      data: { schoolId: school.id, firstName: "Current", lastName: "Classmate", admissionNumber: "cc1", status: "ACTIVE", classArmId: newArm.id },
    });
    await saveScores(school.id, teacher.id, {
      subjectId: subject.id,
      termId: term.id,
      classArmId: newArm.id,
      entries: [{ studentId: currentClassmate.id, componentId: component.id, value: 0 }],
    });

    const reportCard = await computeReportCard(school.id, promoted.id, term.id);
    // Average must be (60 + 100) / 2 = 80 — the JSS2A classmate's score —
    // NOT pulled down by currentClassmate's 0, which belongs to newArm.
    expect(reportCard.subjectRows[0].classAverage).toBe(80);
    expect(reportCard.classSize).toBe(2);
  });

  it("stores the report card's classArmId from the student's own verified score, and never replaces it on recompute", async () => {
    const { school, teacher, subject, term, component, classArm, classGroup } = await makeFixture();
    const student = await prisma.student.create({
      data: { schoolId: school.id, firstName: "Ade", lastName: "Bello", admissionNumber: "s1", status: "ACTIVE", classArmId: classArm.id },
    });
    await saveScores(school.id, teacher.id, {
      subjectId: subject.id,
      termId: term.id,
      classArmId: classArm.id,
      entries: [{ studentId: student.id, componentId: component.id, value: 70 }],
    });

    const first = await computeReportCard(school.id, student.id, term.id);
    expect(first.reportCard.classArmId).toBe(classArm.id);

    // Promote the student and recompute — the already-created ReportCard
    // row must keep its original class.
    const otherArm = await prisma.classArm.create({ data: { schoolId: school.id, classGroupId: classGroup.id, name: "Z" } });
    await updateStudent(school.id, student.id, { classArmId: otherArm.id });

    const second = await computeReportCard(school.id, student.id, term.id);
    expect(second.reportCard.classArmId).toBe(classArm.id);
    expect(second.reportCard.id).toBe(first.reportCard.id);
  });
});
