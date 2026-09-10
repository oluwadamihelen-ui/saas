import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { parseResultsImportCsv, commitResultsImport } from "@/lib/services/results-import";
import { cleanupTestSchools } from "../helpers/factories";

afterAll(cleanupTestSchools);

let counter = 0;
async function makeFixture() {
  counter += 1;
  const slug = `vitest-resultsimport-${Date.now()}-${counter}`;
  const school = await prisma.school.create({ data: { name: slug, slug, status: "ACTIVE" } });
  const role = await prisma.role.create({ data: { schoolId: school.id, key: "TEACHER", name: "Teacher" } });
  const teacher = await prisma.user.create({
    data: { schoolId: school.id, roleId: role.id, email: `${slug}@vitest.local`, passwordHash: "x", name: "Teacher" },
  });
  const subject = await prisma.subject.create({ data: { schoolId: school.id, name: "Mathematics", code: "MTH" } });
  const session = await prisma.academicSession.create({
    data: { schoolId: school.id, name: "2025/2026", startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true },
  });
  const term = await prisma.term.create({
    data: { schoolId: school.id, academicSessionId: session.id, name: "First Term", startDate: new Date("2025-09-01"), endDate: new Date("2025-12-15"), isCurrent: true },
  });
  const component = await prisma.assessmentComponent.create({ data: { schoolId: school.id, name: "CA1", maxScore: 20, order: 0 } });
  const student = await prisma.student.create({
    data: { schoolId: school.id, firstName: "Ade", lastName: "Bello", admissionNumber: `${slug}-1`, status: "ACTIVE" },
  });
  return { school, teacher, subject, session, term, component, student };
}

describe("Results CSV import parsing", () => {
  it("resolves a valid row against session, term, subject, component and student", async () => {
    const { school, subject, session, term, component, student } = await makeFixture();
    const csv = [
      "sessionName,termName,admissionNumber,subjectCode,componentName,score",
      `${session.name},${term.name},${student.admissionNumber},${subject.code},${component.name},18`,
    ].join("\n");

    const { rows, validCount } = await parseResultsImportCsv(school.id, csv);
    expect(validCount).toBe(1);
    expect(rows[0].data).toEqual({ studentId: student.id, subjectId: subject.id, termId: term.id, componentId: component.id, value: 18 });
  });

  it("flags an unknown admission number, subject code and component name independently", async () => {
    const { school, session, term } = await makeFixture();
    const csv = [
      "sessionName,termName,admissionNumber,subjectCode,componentName,score",
      `${session.name},${term.name},NOPE,ZZZ,NOPE,10`,
    ].join("\n");

    const { rows } = await parseResultsImportCsv(school.id, csv);
    expect(rows[0].errors.some((e) => /no student found/i.test(e))).toBe(true);
    expect(rows[0].errors.some((e) => /unknown subject code/i.test(e))).toBe(true);
    expect(rows[0].errors.some((e) => /unknown assessment component/i.test(e))).toBe(true);
  });

  it("requires session name and term name together to resolve the term (a term name alone is ambiguous)", async () => {
    const { school, subject, term, component, student } = await makeFixture();
    const csv = [
      "sessionName,termName,admissionNumber,subjectCode,componentName,score",
      `Wrong Session,${term.name},${student.admissionNumber},${subject.code},${component.name},10`,
    ].join("\n");

    const { rows } = await parseResultsImportCsv(school.id, csv);
    expect(rows[0].data).toBeNull();
    expect(rows[0].errors.some((e) => /no term/i.test(e))).toBe(true);
  });

  it("rejects a score above the component's maximum", async () => {
    const { school, subject, session, term, component, student } = await makeFixture();
    const csv = [
      "sessionName,termName,admissionNumber,subjectCode,componentName,score",
      `${session.name},${term.name},${student.admissionNumber},${subject.code},${component.name},25`,
    ].join("\n");

    const { rows } = await parseResultsImportCsv(school.id, csv);
    expect(rows[0].data).toBeNull();
    expect(rows[0].errors.some((e) => /exceeds/i.test(e))).toBe(true);
  });

  it("rejects a negative or non-numeric score", async () => {
    const { school, subject, session, term, component, student } = await makeFixture();
    const csv = [
      "sessionName,termName,admissionNumber,subjectCode,componentName,score",
      `${session.name},${term.name},${student.admissionNumber},${subject.code},${component.name},-5`,
      `${session.name},${term.name},${student.admissionNumber},${subject.code},${component.name},abc`,
    ].join("\n");

    const { rows } = await parseResultsImportCsv(school.id, csv);
    expect(rows[0].errors.some((e) => /negative/i.test(e))).toBe(true);
    expect(rows[1].errors.some((e) => /number/i.test(e))).toBe(true);
  });
});

describe("Results CSV import commit", () => {
  it("creates a new Score row for a first-time entry", async () => {
    const { school, teacher, subject, term, component, student } = await makeFixture();
    await commitResultsImport(school.id, teacher.id, [{ studentId: student.id, subjectId: subject.id, termId: term.id, componentId: component.id, value: 15 }]);

    const score = await prisma.score.findUnique({
      where: { studentId_subjectId_termId_componentId: { studentId: student.id, subjectId: subject.id, termId: term.id, componentId: component.id } },
    });
    expect(score?.value).toBe(15);
  });

  it("overwrites rather than duplicates when the same (student, subject, term, component) is imported again", async () => {
    const { school, teacher, subject, term, component, student } = await makeFixture();
    const entry = { studentId: student.id, subjectId: subject.id, termId: term.id, componentId: component.id, value: 10 };
    await commitResultsImport(school.id, teacher.id, [entry]);
    await commitResultsImport(school.id, teacher.id, [{ ...entry, value: 17 }]);

    const scores = await prisma.score.findMany({ where: { schoolId: school.id, studentId: student.id } });
    expect(scores).toHaveLength(1);
    expect(scores[0].value).toBe(17);
  });
});
