import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createStudent } from "@/lib/services/students";
import { admitApplicant } from "@/lib/services/admission";
import { commitStudentImport } from "@/lib/services/student-import";
import { cleanupTestSchools } from "../helpers/factories";

afterAll(cleanupTestSchools);

let counter = 0;
async function makeSchool(admissionNumberPrefix: string | null = null) {
  counter += 1;
  const slug = `vitest-adm-${Date.now()}-${counter}`;
  return prisma.school.create({ data: { name: slug, slug, status: "ACTIVE", admissionNumberPrefix } });
}

describe("Admission number generation", () => {
  it("uses the plain YYYY-NNNN format when the school has no prefix configured", async () => {
    const school = await makeSchool(null);
    const student = await createStudent(school.id, { firstName: "Ada", lastName: "Bello" });
    expect(student.admissionNumber).toMatch(/^\d{4}-\d{4}$/);
  });

  it("prefixes the admission number with the school's configured abbreviation", async () => {
    const school = await makeSchool("WMS");
    const student = await createStudent(school.id, { firstName: "Chidi", lastName: "Okoro" });
    expect(student.admissionNumber).toMatch(/^WMS-\d{4}-\d{4}$/);
  });

  it("gives each school its own prefix — never another school's", async () => {
    const schoolA = await makeSchool("WMS");
    const schoolB = await makeSchool("BFA");

    const studentA = await createStudent(schoolA.id, { firstName: "Ada", lastName: "A" });
    const studentB = await createStudent(schoolB.id, { firstName: "Bola", lastName: "B" });

    expect(studentA.admissionNumber.startsWith("WMS-")).toBe(true);
    expect(studentB.admissionNumber.startsWith("BFA-")).toBe(true);
    expect(studentB.admissionNumber.startsWith("WMS-")).toBe(false);
  });

  it("changing the school's prefix never rewrites an existing student's admission number, and only new students get the new prefix", async () => {
    const school = await makeSchool("WMS");
    const existing = await createStudent(school.id, { firstName: "Old", lastName: "Student" });
    expect(existing.admissionNumber.startsWith("WMS-")).toBe(true);

    await prisma.school.update({ where: { id: school.id }, data: { admissionNumberPrefix: "WMIS" } });

    const stillUnchanged = await prisma.student.findUnique({ where: { id: existing.id } });
    expect(stillUnchanged?.admissionNumber).toBe(existing.admissionNumber);
    expect(stillUnchanged?.admissionNumber.startsWith("WMS-")).toBe(true);

    const afterChange = await createStudent(school.id, { firstName: "New", lastName: "Student" });
    expect(afterChange.admissionNumber.startsWith("WMIS-")).toBe(true);
  });

  it("never produces duplicate admission numbers under concurrent auto-generated creation", async () => {
    const school = await makeSchool("CNC");
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => createStudent(school.id, { firstName: "Concurrent", lastName: `Student${i}` }))
    );
    const numbers = results.map((s) => s.admissionNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(numbers.every((n) => n.startsWith("CNC-"))).toBe(true);
  });

  it("preserves a historical admission number supplied by CSV import, even when the school has a prefix configured", async () => {
    const school = await makeSchool("WMS");
    const outcome = await commitStudentImport(school.id, [
      { rowNumber: 2, data: { admissionNumber: "OLD/2019/0102", firstName: "Legacy", lastName: "Student" } },
    ]);
    expect(outcome.created).toBe(1);
    expect(outcome.failed).toHaveLength(0);

    const student = await prisma.student.findFirst({ where: { schoolId: school.id, firstName: "Legacy" } });
    expect(student?.admissionNumber).toBe("OLD/2019/0102");
  });

  it("still reports a real duplicate as an error rather than silently generating a different number, when the caller supplied an explicit admission number", async () => {
    const school = await makeSchool("WMS");
    await createStudent(school.id, { admissionNumber: "DUP-001", firstName: "First", lastName: "One" });

    const outcome = await commitStudentImport(school.id, [
      { rowNumber: 2, data: { admissionNumber: "DUP-001", firstName: "Second", lastName: "One" } },
    ]);
    expect(outcome.created).toBe(0);
    expect(outcome.failed).toHaveLength(1);
    expect(outcome.failed[0].error).toContain("already in use");
  });

  it("uses the configured prefix when an accepted applicant is admitted into a student", async () => {
    const school = await makeSchool("BFA");
    const applicant = await prisma.applicant.create({
      data: {
        schoolId: school.id,
        childFirstName: "Applied",
        childLastName: "Child",
        parentName: "Parent Guardian",
        parentPhone: "08000000000",
        parentEmail: "parent@example.com",
        status: "ACCEPTED",
      },
    });

    const student = await admitApplicant(school.id, applicant.id);
    expect(student.admissionNumber.startsWith("BFA-")).toBe(true);
  });
});
