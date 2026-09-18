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
  const classGroup = await prisma.classGroup.create({ data: { schoolId: school.id, name: "JSS 2", order: 1 } });
  const classArm = await prisma.classArm.create({ data: { schoolId: school.id, classGroupId: classGroup.id, name: "A" } });
  const student = await prisma.student.create({
    data: { schoolId: school.id, firstName: "Ade", lastName: "Bello", admissionNumber: `${slug}-1`, status: "ACTIVE", classArmId: classArm.id },
  });
  return { school, teacher, subject, session, term, component, classGroup, classArm, student };
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
    expect(rows[0].data).toEqual({
      studentId: student.id,
      subjectId: subject.id,
      termId: term.id,
      academicSessionId: session.id,
      componentId: component.id,
      value: 18,
      classArmId: null,
    });
  });

  it("warns (but still imports) a row with no className column", async () => {
    const { school, subject, session, term, component, student } = await makeFixture();
    const csv = [
      "sessionName,termName,admissionNumber,subjectCode,componentName,score",
      `${session.name},${term.name},${student.admissionNumber},${subject.code},${component.name},18`,
    ].join("\n");

    const { rows } = await parseResultsImportCsv(school.id, csv);
    expect(rows[0].data).not.toBeNull();
    expect(rows[0].errors).toHaveLength(0);
    expect(rows[0].warnings.some((w) => /no class given/i.test(w))).toBe(true);
  });

  it("resolves className to a classArmId when it matches an existing class exactly", async () => {
    const { school, subject, session, term, component, student, classGroup, classArm } = await makeFixture();
    const csv = [
      "sessionName,termName,className,admissionNumber,subjectCode,componentName,score",
      `${session.name},${term.name},"${classGroup.name} ${classArm.name}",${student.admissionNumber},${subject.code},${component.name},18`,
    ].join("\n");

    const { rows } = await parseResultsImportCsv(school.id, csv);
    expect(rows[0].errors).toHaveLength(0);
    expect(rows[0].warnings).toHaveLength(0);
    expect(rows[0].data?.classArmId).toBe(classArm.id);
  });

  it("rejects a className that doesn't match any existing class", async () => {
    const { school, subject, session, term, component, student } = await makeFixture();
    const csv = [
      "sessionName,termName,className,admissionNumber,subjectCode,componentName,score",
      `${session.name},${term.name},Nonexistent Class,${student.admissionNumber},${subject.code},${component.name},18`,
    ].join("\n");

    const { rows } = await parseResultsImportCsv(school.id, csv);
    expect(rows[0].data).toBeNull();
    expect(rows[0].errors.some((e) => /unknown class/i.test(e))).toBe(true);
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
    const { school, teacher, subject, term, session, component, student } = await makeFixture();
    await commitResultsImport(school.id, teacher.id, [
      { studentId: student.id, subjectId: subject.id, termId: term.id, academicSessionId: session.id, componentId: component.id, value: 15, classArmId: null },
    ]);

    const score = await prisma.score.findUnique({
      where: { studentId_subjectId_termId_componentId: { studentId: student.id, subjectId: subject.id, termId: term.id, componentId: component.id } },
    });
    expect(score?.value).toBe(15);
  });

  it("overwrites rather than duplicates when the same (student, subject, term, component) is imported again", async () => {
    const { school, teacher, subject, term, session, component, student } = await makeFixture();
    const entry = { studentId: student.id, subjectId: subject.id, termId: term.id, academicSessionId: session.id, componentId: component.id, value: 10, classArmId: null };
    await commitResultsImport(school.id, teacher.id, [entry]);
    await commitResultsImport(school.id, teacher.id, [{ ...entry, value: 17 }]);

    const scores = await prisma.score.findMany({ where: { schoolId: school.id, studentId: student.id } });
    expect(scores).toHaveLength(1);
    expect(scores[0].value).toBe(17);
  });

  it("leaves classArmId null when no class is given, rather than guessing", async () => {
    const { school, teacher, subject, term, session, component, student } = await makeFixture();
    await commitResultsImport(school.id, teacher.id, [
      { studentId: student.id, subjectId: subject.id, termId: term.id, academicSessionId: session.id, componentId: component.id, value: 15, classArmId: null },
    ]);

    const score = await prisma.score.findUnique({
      where: { studentId_subjectId_termId_componentId: { studentId: student.id, subjectId: subject.id, termId: term.id, componentId: component.id } },
    });
    expect(score?.classArmId).toBeNull();
    expect(score?.classArmSource).toBeNull();
  });

  it("stores an explicit className as a verified, permanent historical class — the critical historical-import scenario", async () => {
    const { school, teacher, subject, component, student, classArm: jss2a } = await makeFixture();

    // Student is CURRENTLY in a different class (SS 3) from the class
    // being imported for (JSS 2 A) — exactly the promoted-student
    // scenario the whole feature exists to get right.
    const ss3Group = await prisma.classGroup.create({ data: { schoolId: school.id, name: "SS 3", order: 6 } });
    const ss3 = await prisma.classArm.create({ data: { schoolId: school.id, classGroupId: ss3Group.id, name: "A" } });
    await prisma.student.update({ where: { id: student.id }, data: { classArmId: ss3.id } });

    // A past session/term — not the fixture's "current" one.
    const pastSession = await prisma.academicSession.create({
      data: { schoolId: school.id, name: "2021/2022", startDate: new Date("2021-09-01"), endDate: new Date("2022-07-31"), isCurrent: false },
    });
    const pastTerm = await prisma.term.create({
      data: { schoolId: school.id, academicSessionId: pastSession.id, name: "First Term", startDate: new Date("2021-09-01"), endDate: new Date("2021-12-15"), isCurrent: false },
    });

    await commitResultsImport(school.id, teacher.id, [
      { studentId: student.id, subjectId: subject.id, termId: pastTerm.id, academicSessionId: pastSession.id, componentId: component.id, value: 18, classArmId: jss2a.id },
    ]);

    // 1. Score.classArmId is the imported historical class (JSS 2 A) —
    //    never the student's current class (SS 3).
    const score = await prisma.score.findUnique({
      where: { studentId_subjectId_termId_componentId: { studentId: student.id, subjectId: subject.id, termId: pastTerm.id, componentId: component.id } },
    });
    expect(score?.classArmId).toBe(jss2a.id);
    expect(score?.classArmSource).toBe("IMPORTED");

    // 2. Student.classArmId (current class) is completely untouched.
    const refreshedStudent = await prisma.student.findUnique({ where: { id: student.id } });
    expect(refreshedStudent?.classArmId).toBe(ss3.id);

    // 3. A StudentClassHistory row was created for the historical class.
    const history = await prisma.studentClassHistory.findMany({ where: { schoolId: school.id, studentId: student.id } });
    expect(history).toHaveLength(1);
    expect(history[0].classArmId).toBe(jss2a.id);
    expect(history[0].academicSessionId).toBe(pastSession.id);
    expect(history[0].source).toBe("IMPORTED");

    // 4. Editing the historical score's value afterward does not change
    //    its recorded class.
    await commitResultsImport(school.id, teacher.id, [
      { studentId: student.id, subjectId: subject.id, termId: pastTerm.id, academicSessionId: pastSession.id, componentId: component.id, value: 12, classArmId: null },
    ]);
    const scoreAfterReimport = await prisma.score.findUnique({
      where: { studentId_subjectId_termId_componentId: { studentId: student.id, subjectId: subject.id, termId: pastTerm.id, componentId: component.id } },
    });
    expect(scoreAfterReimport?.value).toBe(12);
    expect(scoreAfterReimport?.classArmId).toBe(jss2a.id);
  });

  it("does not duplicate StudentClassHistory rows across multiple scores for the same student/session/class", async () => {
    const { school, teacher, subject, term, session, component, student, classArm } = await makeFixture();
    const otherSubject = await prisma.subject.create({ data: { schoolId: school.id, name: "English", code: "ENG" } });

    await commitResultsImport(school.id, teacher.id, [
      { studentId: student.id, subjectId: subject.id, termId: term.id, academicSessionId: session.id, componentId: component.id, value: 15, classArmId: classArm.id },
      { studentId: student.id, subjectId: otherSubject.id, termId: term.id, academicSessionId: session.id, componentId: component.id, value: 14, classArmId: classArm.id },
    ]);

    const history = await prisma.studentClassHistory.findMany({ where: { schoolId: school.id, studentId: student.id } });
    expect(history).toHaveLength(1);

    // Re-importing again (e.g. a corrected re-upload) must not add a
    // second row either.
    await commitResultsImport(school.id, teacher.id, [
      { studentId: student.id, subjectId: subject.id, termId: term.id, academicSessionId: session.id, componentId: component.id, value: 16, classArmId: classArm.id },
    ]);
    const historyAfter = await prisma.studentClassHistory.findMany({ where: { schoolId: school.id, studentId: student.id } });
    expect(historyAfter).toHaveLength(1);
  });
});
