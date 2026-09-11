import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  getStudentAcademicHistory,
  computeTranscriptSummary,
  generateTranscript,
  getTranscript,
  listTranscriptsForStudent,
  revokeTranscript,
  verifyTranscriptPublic,
} from "@/lib/services/transcripts";
import { createTestSchool, cleanupTestSchools } from "../helpers/factories";

afterAll(cleanupTestSchools);

let counter = 0;

/// A school with two academic sessions the student actually has scores in
/// (a past session recorded under one class arm, via a real AttendanceRecord,
/// and the current session under the student's current class arm), plus one
/// grade band so grade/remark lookups are real school configuration rather
/// than invented values.
async function makeSchoolWithHistory() {
  counter += 1;
  const tag = `vitest-tr-${Date.now()}-${counter}`;
  const { school } = await createTestSchool({ planTier: "PROFESSIONAL" });

  const role = await prisma.role.create({ data: { schoolId: school.id, key: "SCHOOL_OWNER", name: "Owner" } });
  const staff = await prisma.user.create({
    data: { schoolId: school.id, roleId: role.id, email: `${tag}-staff@vitest.local`, passwordHash: "x", name: "Staff User" },
  });

  const pastSession = await prisma.academicSession.create({
    data: { schoolId: school.id, name: "2024/2025", startDate: new Date("2024-09-01"), endDate: new Date("2025-07-31"), isCurrent: false },
  });
  const pastTerm = await prisma.term.create({
    data: { schoolId: school.id, academicSessionId: pastSession.id, name: "First Term", startDate: new Date("2024-09-01"), endDate: new Date("2024-12-15"), isCurrent: false },
  });

  const currentSession = await prisma.academicSession.create({
    data: { schoolId: school.id, name: "2025/2026", startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true },
  });
  const currentTerm = await prisma.term.create({
    data: { schoolId: school.id, academicSessionId: currentSession.id, name: "First Term", startDate: new Date("2025-09-01"), endDate: new Date("2025-12-15"), isCurrent: true },
  });

  const classGroup = await prisma.classGroup.create({ data: { schoolId: school.id, name: "JSS1", order: 0 } });
  const pastArm = await prisma.classArm.create({ data: { schoolId: school.id, classGroupId: classGroup.id, name: "Blue" } });
  const currentArm = await prisma.classArm.create({ data: { schoolId: school.id, classGroupId: classGroup.id, name: "Gold" } });

  const subject = await prisma.subject.create({ data: { schoolId: school.id, name: "Mathematics", code: `${tag}-MTH` } });
  const component = await prisma.assessmentComponent.create({ data: { schoolId: school.id, name: "Exam", maxScore: 100, order: 0 } });
  await prisma.gradeBand.createMany({
    data: [
      { schoolId: school.id, grade: "A", minScore: 70, maxScore: 100, remark: "Excellent", order: 0 },
      { schoolId: school.id, grade: "F", minScore: 0, maxScore: 69, remark: "Fail", order: 1 },
    ],
  });

  const student = await prisma.student.create({
    data: {
      schoolId: school.id,
      classArmId: currentArm.id,
      firstName: "Ada",
      lastName: "Lovelace",
      admissionNumber: `${tag}-ADM`,
      admissionDate: new Date("2024-09-01"),
      status: "ACTIVE",
    },
  });

  await prisma.score.create({
    data: { schoolId: school.id, studentId: student.id, subjectId: subject.id, termId: pastTerm.id, componentId: component.id, value: 80, enteredById: staff.id },
  });
  await prisma.score.create({
    data: { schoolId: school.id, studentId: student.id, subjectId: subject.id, termId: currentTerm.id, componentId: component.id, value: 90, enteredById: staff.id },
  });

  // Real, previously-recorded evidence of which class the student was in
  // during the past term — exactly what getStudentAcademicHistory reuses
  // instead of inventing a promotion-history table.
  await prisma.attendanceRecord.create({
    data: { schoolId: school.id, studentId: student.id, classArmId: pastArm.id, termId: pastTerm.id, date: new Date("2024-09-10"), status: "PRESENT", markedById: staff.id },
  });

  return { school, staff, student, pastSession, pastTerm, currentSession, currentTerm, pastArm, currentArm };
}

describe("getStudentAcademicHistory", () => {
  it("returns every session the student has scores in, oldest first, with the real recorded class per term", async () => {
    const { school, student, pastSession, currentSession, pastArm, currentArm } = await makeSchoolWithHistory();

    const { sessions, isIncomplete } = await getStudentAcademicHistory(school.id, student.id);

    expect(sessions.map((s) => s.sessionId)).toEqual([pastSession.id, currentSession.id]);
    expect(sessions[0].terms[0].classLabel).toBe(`JSS1 ${pastArm.name}`);
    expect(sessions[1].terms[0].classLabel).toBe(`JSS1 ${currentArm.name}`);
    expect(isIncomplete).toBe(false);
  });

  it("never invents a class for a historical term with no attendance record and no current-term fallback", async () => {
    const { school, staff, student, currentTerm } = await makeSchoolWithHistory();

    // A second, older, non-current session/term with a score but no
    // AttendanceRecord at all.
    const staleSession = await prisma.academicSession.create({
      data: { schoolId: school.id, name: "2023/2024", startDate: new Date("2023-09-01"), endDate: new Date("2024-07-31"), isCurrent: false },
    });
    const staleTerm = await prisma.term.create({
      data: { schoolId: school.id, academicSessionId: staleSession.id, name: "First Term", startDate: new Date("2023-09-01"), endDate: new Date("2023-12-15"), isCurrent: false },
    });
    const subject2 = await prisma.subject.create({ data: { schoolId: school.id, name: "English", code: `stale-${Date.now()}` } });
    const component = (await prisma.assessmentComponent.findFirst({ where: { schoolId: school.id } }))!;
    await prisma.score.create({
      data: { schoolId: school.id, studentId: student.id, subjectId: subject2.id, termId: staleTerm.id, componentId: component.id, value: 55, enteredById: staff.id },
    });

    const { sessions, isIncomplete } = await getStudentAcademicHistory(school.id, student.id);
    const staleGroup = sessions.find((s) => s.sessionId === staleSession.id)!;

    expect(staleGroup.terms[0].classLabel).toBeNull();
    expect(isIncomplete).toBe(true);
    // currentTerm sanity: still resolved via fallback, unaffected by the stale term.
    const currentGroup = sessions.find((s) => s.terms.some((t) => t.termId === currentTerm.id))!;
    expect(currentGroup.terms[0].classLabel).not.toBeNull();
  });

  it("never fabricates GPA — grade/remark come only from the school's own configured GradeBand", async () => {
    const { school, student } = await makeSchoolWithHistory();
    const { sessions } = await getStudentAcademicHistory(school.id, student.id);
    const pastRow = sessions[0].terms[0].subjectRows[0];

    expect(pastRow.grade).toBe("A");
    expect(pastRow.remark).toBe("Excellent");
  });
});

describe("computeTranscriptSummary", () => {
  it("derives sessionsAttended/classesCompleted/performanceRemark from real data only", async () => {
    const { school, student } = await makeSchoolWithHistory();
    const { sessions } = await getStudentAcademicHistory(school.id, student.id);
    const summary = await computeTranscriptSummary(school.id, student, sessions);

    expect(summary.sessionsAttended).toBe(2);
    expect(summary.classesCompleted).toEqual(expect.arrayContaining(["JSS1 Blue", "JSS1 Gold"]));
    // (80 + 90) / 2 = 85 -> falls in the school's own "A"/"Excellent" band.
    expect(summary.overallAverage).toBe(85);
    expect(summary.performanceRemark).toBe("Excellent");
  });
});

describe("generateTranscript", () => {
  it("issues a unique WIN-TR-<year>-###### reference number and refuses a student with no academic records", async () => {
    const { school, staff, student } = await makeSchoolWithHistory();

    const transcript = await generateTranscript(school.id, student.id, staff.id);
    expect(transcript.referenceNumber).toMatch(/^WIN-TR-\d{4}-\d{6}$/);
    expect(transcript.status).toBe("ACTIVE");

    const barren = await prisma.student.create({
      data: { schoolId: school.id, firstName: "No", lastName: "Records", admissionNumber: `barren-${Date.now()}`, status: "ACTIVE" },
    });
    await expect(generateTranscript(school.id, barren.id, staff.id)).rejects.toThrow(
      "No academic records are currently available for this student."
    );
  });
});

describe("revocation and public verification", () => {
  it("verifies ACTIVE, then REVOKED after revocation — the record itself is never deleted", async () => {
    const { school, staff, student } = await makeSchoolWithHistory();
    const transcript = await generateTranscript(school.id, student.id, staff.id);

    const beforeRevoke = await verifyTranscriptPublic(transcript.referenceNumber, transcript.verificationCode);
    expect(beforeRevoke?.status).toBe("ACTIVE");
    expect(beforeRevoke?.studentName).toBe(`${student.firstName} ${student.lastName}`);

    await revokeTranscript(school.id, transcript.id, staff.id, "Issued in error");

    const afterRevoke = await verifyTranscriptPublic(transcript.referenceNumber, transcript.verificationCode);
    expect(afterRevoke?.status).toBe("REVOKED");

    const stillOnFile = await getTranscript(school.id, transcript.id);
    expect(stillOnFile).not.toBeNull();
    expect(stillOnFile?.status).toBe("REVOKED");
    expect(stillOnFile?.revokedReason).toBe("Issued in error");
  });

  it("returns null for an unknown reference number rather than throwing", async () => {
    const result = await verifyTranscriptPublic("WIN-TR-0000-000000", "any-code");
    expect(result).toBeNull();
  });

  it("requires the verification code, not just the (predictable, sequential) reference number", async () => {
    const { school, staff, student } = await makeSchoolWithHistory();
    const transcript = await generateTranscript(school.id, student.id, staff.id);

    // The reference number alone (WIN-TR-{year}-{sequence}) is a guessable,
    // globally-sequential counter — without also matching the random
    // verificationCode, anyone could script through every issued
    // transcript across every school and read out student names.
    const withoutCode = await verifyTranscriptPublic(transcript.referenceNumber, "wrong-code");
    expect(withoutCode).toBeNull();

    const withCode = await verifyTranscriptPublic(transcript.referenceNumber, transcript.verificationCode);
    expect(withCode).not.toBeNull();
  });
});

describe("multi-school tenant isolation", () => {
  it("never lets one school read or list another school's transcript", async () => {
    const a = await makeSchoolWithHistory();
    const b = await makeSchoolWithHistory();

    const transcript = await generateTranscript(a.school.id, a.student.id, a.staff.id);

    expect(await getTranscript(b.school.id, transcript.id)).toBeNull();
    const listForOtherSchoolStudent = await listTranscriptsForStudent(b.school.id, a.student.id);
    expect(listForOtherSchoolStudent).toHaveLength(0);

    // Public verification is intentionally cross-school (any valid
    // reference number + verification code pair is enough — no school
    // context is required up front), but still only ever exposes the
    // minimal fields.
    const publicResult = await verifyTranscriptPublic(transcript.referenceNumber, transcript.verificationCode);
    expect(publicResult?.schoolName).toBe(a.school.name);
    expect(Object.keys(publicResult ?? {})).toEqual(
      expect.arrayContaining(["status", "referenceNumber", "schoolName", "schoolLogoUrl", "studentName", "generatedAt"])
    );
  });
});
