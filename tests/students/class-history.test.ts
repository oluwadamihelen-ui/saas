import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createStudent, updateStudent, withdrawStudent } from "@/lib/services/students";
import { cleanupTestSchools } from "../helpers/factories";

afterAll(cleanupTestSchools);

let counter = 0;
async function makeFixture() {
  counter += 1;
  const slug = `vitest-classhistory-${Date.now()}-${counter}`;
  const school = await prisma.school.create({ data: { name: slug, slug, status: "ACTIVE" } });
  const session = await prisma.academicSession.create({
    data: { schoolId: school.id, name: "2025/2026", startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true },
  });
  const jss1Group = await prisma.classGroup.create({ data: { schoolId: school.id, name: "JSS 1", order: 1 } });
  const jss1a = await prisma.classArm.create({ data: { schoolId: school.id, classGroupId: jss1Group.id, name: "A" } });
  const jss2Group = await prisma.classGroup.create({ data: { schoolId: school.id, name: "JSS 2", order: 2 } });
  const jss2a = await prisma.classArm.create({ data: { schoolId: school.id, classGroupId: jss2Group.id, name: "A" } });
  const jss2b = await prisma.classArm.create({ data: { schoolId: school.id, classGroupId: jss2Group.id, name: "B" } });
  return { school, session, jss1Group, jss1a, jss2Group, jss2a, jss2b };
}

describe("StudentClassHistory — deliberate write paths only", () => {
  it("creating a student with a class writes one ENTERED history row, and leaves Student.classArmId as the current class", async () => {
    const { school, session, jss1a } = await makeFixture();
    const student = await createStudent(school.id, { firstName: "Ade", lastName: "Bello", classArmId: jss1a.id });

    const history = await prisma.studentClassHistory.findMany({ where: { schoolId: school.id, studentId: student.id } });
    expect(history).toHaveLength(1);
    expect(history[0].classArmId).toBe(jss1a.id);
    expect(history[0].academicSessionId).toBe(session.id);
    expect(history[0].source).toBe("ENTERED");
    expect(history[0].endDate).toBeNull();

    const refreshed = await prisma.student.findUnique({ where: { id: student.id } });
    expect(refreshed?.classArmId).toBe(jss1a.id);
  });

  it("creating a student with no class writes no history row", async () => {
    const { school } = await makeFixture();
    const student = await createStudent(school.id, { firstName: "Ade", lastName: "Bello" });

    const history = await prisma.studentClassHistory.findMany({ where: { schoolId: school.id, studentId: student.id } });
    expect(history).toHaveLength(0);
  });

  it("promoting a student (changing classArmId) closes the old history row and opens a new one", async () => {
    const { school, jss1a, jss2a } = await makeFixture();
    const student = await createStudent(school.id, { firstName: "Ade", lastName: "Bello", classArmId: jss1a.id });

    await updateStudent(school.id, student.id, { classArmId: jss2a.id });

    const history = await prisma.studentClassHistory.findMany({
      where: { schoolId: school.id, studentId: student.id },
      orderBy: { createdAt: "asc" },
    });
    expect(history).toHaveLength(2);
    expect(history[0].classArmId).toBe(jss1a.id);
    expect(history[0].endDate).not.toBeNull();
    expect(history[1].classArmId).toBe(jss2a.id);
    expect(history[1].endDate).toBeNull();

    const refreshed = await prisma.student.findUnique({ where: { id: student.id } });
    expect(refreshed?.classArmId).toBe(jss2a.id);
  });

  it("a class-arm transfer within the same class group (JSS2A -> JSS2B) is logged the same way", async () => {
    const { school, jss2a, jss2b } = await makeFixture();
    const student = await createStudent(school.id, { firstName: "Ade", lastName: "Bello", classArmId: jss2a.id });

    await updateStudent(school.id, student.id, { classArmId: jss2b.id });

    const history = await prisma.studentClassHistory.findMany({ where: { schoolId: school.id, studentId: student.id } });
    expect(history).toHaveLength(2);
    expect(history.map((h) => h.classArmId).sort()).toEqual([jss2a.id, jss2b.id].sort());
  });

  it("editing an unrelated field (no class change) does not write a new history row", async () => {
    const { school, jss1a } = await makeFixture();
    const student = await createStudent(school.id, { firstName: "Ade", lastName: "Bello", classArmId: jss1a.id });

    await updateStudent(school.id, student.id, { firstName: "Adaeze" });
    await updateStudent(school.id, student.id, { classArmId: jss1a.id }); // re-submitting the same class

    const history = await prisma.studentClassHistory.findMany({ where: { schoolId: school.id, studentId: student.id } });
    expect(history).toHaveLength(1);
  });

  it("withdrawing a student closes their open history row with status WITHDRAWN, without touching Student.classArmId", async () => {
    const { school, jss1a } = await makeFixture();
    const student = await createStudent(school.id, { firstName: "Ade", lastName: "Bello", classArmId: jss1a.id });

    await withdrawStudent(school.id, student.id);

    const history = await prisma.studentClassHistory.findMany({ where: { schoolId: school.id, studentId: student.id } });
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe("WITHDRAWN");
    expect(history[0].endDate).not.toBeNull();

    const refreshed = await prisma.student.findUnique({ where: { id: student.id } });
    expect(refreshed?.status).toBe("WITHDRAWN");
    expect(refreshed?.classArmId).toBe(jss1a.id); // current-class field itself is untouched
  });

  it("repeating a class (re-assigned to the same class group in a later session) is just another row, not a conflict", async () => {
    const { school, jss1a } = await makeFixture();
    const student = await createStudent(school.id, { firstName: "Ade", lastName: "Bello", classArmId: jss1a.id });

    // Simulate a new session becoming current (as would happen at real
    // session rollover) and the student repeating JSS1A.
    await prisma.academicSession.updateMany({ where: { schoolId: school.id }, data: { isCurrent: false } });
    const nextSession = await prisma.academicSession.create({
      data: { schoolId: school.id, name: "2026/2027", startDate: new Date("2026-09-01"), endDate: new Date("2027-07-31"), isCurrent: true },
    });

    await updateStudent(school.id, student.id, { classArmId: null });
    await updateStudent(school.id, student.id, { classArmId: jss1a.id });

    const history = await prisma.studentClassHistory.findMany({
      where: { schoolId: school.id, studentId: student.id },
      orderBy: { createdAt: "asc" },
    });
    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history[history.length - 1].academicSessionId).toBe(nextSession.id);
    expect(history[history.length - 1].classArmId).toBe(jss1a.id);
  });
});
