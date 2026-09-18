import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { parseStudentImportCsv, commitStudentImport } from "@/lib/services/student-import";
import { createStudent } from "@/lib/services/students";
import { cleanupTestSchools } from "../helpers/factories";

afterAll(cleanupTestSchools);

let counter = 0;
async function makeSchoolWithClass() {
  counter += 1;
  const slug = `vitest-studentimport-${Date.now()}-${counter}`;
  const school = await prisma.school.create({ data: { name: slug, slug, status: "ACTIVE" } });
  const classGroup = await prisma.classGroup.create({ data: { schoolId: school.id, name: "Primary 1", order: 0 } });
  const classArm = await prisma.classArm.create({ data: { schoolId: school.id, classGroupId: classGroup.id, name: "A" } });
  return { school, classArm };
}

const HEADER = "admissionNumber,firstName,lastName,gender,dateOfBirth,className,guardianFirstName,guardianLastName,guardianPhone,guardianRelationship";

describe("Student CSV import parsing", () => {
  it("parses a valid row and resolves className to an existing class arm", async () => {
    const { school } = await makeSchoolWithClass();
    const csv = [HEADER, ",Ade,Bello,MALE,2016-05-01,Primary 1 A,,,,"].join("\n");

    const { rows, validCount } = await parseStudentImportCsv(school.id, csv);
    expect(validCount).toBe(1);
    expect(rows[0].data?.firstName).toBe("Ade");
    expect(rows[0].data?.classArmId).toBeTruthy();
  });

  it("requires first and last name", async () => {
    const { school } = await makeSchoolWithClass();
    const csv = [HEADER, ",,Bello,,,,,,,"].join("\n");

    const { rows } = await parseStudentImportCsv(school.id, csv);
    expect(rows[0].data).toBeNull();
    expect(rows[0].errors.some((e) => /first name/i.test(e))).toBe(true);
  });

  it("flags an unknown class name", async () => {
    const { school } = await makeSchoolWithClass();
    const csv = [HEADER, ",Ade,Bello,,,Nonexistent Class,,,,"].join("\n");

    const { rows } = await parseStudentImportCsv(school.id, csv);
    expect(rows[0].data).toBeNull();
    expect(rows[0].errors.some((e) => /unknown class/i.test(e))).toBe(true);
  });

  it("flags an invalid gender and an invalid date of birth", async () => {
    const { school } = await makeSchoolWithClass();
    const csv = [HEADER, ",Ade,Bello,OTHER,not-a-date,,,,,"].join("\n");

    const { rows } = await parseStudentImportCsv(school.id, csv);
    expect(rows[0].errors.some((e) => /gender/i.test(e))).toBe(true);
    expect(rows[0].errors.some((e) => /date of birth/i.test(e))).toBe(true);
  });

  it("only attaches a guardian when firstName, lastName and phone are all present", async () => {
    const { school } = await makeSchoolWithClass();
    const csv = [HEADER, ",Ade,Bello,,,,,,,", ",Chidi,Okafor,,,,Funke,Okafor,08011112222,MOTHER"].join("\n");

    const { rows } = await parseStudentImportCsv(school.id, csv);
    expect(rows[0].data?.guardian).toBeNull();
    expect(rows[1].data?.guardian).toEqual({ firstName: "Funke", lastName: "Okafor", phone: "08011112222", email: null, relationship: "MOTHER" });
  });

  it("flags a duplicate admission number repeated within the same file", async () => {
    const { school } = await makeSchoolWithClass();
    const csv = [HEADER, "2023-0001,Ade,Bello,,,,,,,", "2023-0001,Chidi,Okafor,,,,,,,"].join("\n");

    const { rows } = await parseStudentImportCsv(school.id, csv);
    expect(rows[0].errors).toHaveLength(0);
    expect(rows[1].errors.some((e) => /repeated earlier/i.test(e))).toBe(true);
  });
});

describe("Student CSV import commit", () => {
  it("enrolls every valid row, generating an admission number when none was given", async () => {
    const { school, classArm } = await makeSchoolWithClass();
    const outcome = await commitStudentImport(school.id, [
      { rowNumber: 2, data: { firstName: "Ade", lastName: "Bello", classArmId: classArm.id } },
      { rowNumber: 3, data: { firstName: "Chidi", lastName: "Okafor", classArmId: classArm.id } },
    ]);

    expect(outcome.created).toBe(2);
    expect(outcome.failed).toHaveLength(0);
    const students = await prisma.student.findMany({ where: { schoolId: school.id } });
    expect(students).toHaveLength(2);
    expect(students.every((s) => s.admissionNumber)).toBe(true);
  });

  it("preserves an explicit admission number from the file", async () => {
    const { school } = await makeSchoolWithClass();
    await commitStudentImport(school.id, [{ rowNumber: 2, data: { admissionNumber: "LEGACY-001", firstName: "Ade", lastName: "Bello" } }]);

    const student = await prisma.student.findFirst({ where: { schoolId: school.id } });
    expect(student?.admissionNumber).toBe("LEGACY-001");
  });

  it("reports a friendly error for a row whose admission number collides with an existing student, without discarding earlier rows", async () => {
    const { school } = await makeSchoolWithClass();
    await createStudent(school.id, { admissionNumber: "DUP-001", firstName: "Existing", lastName: "Student" });

    const outcome = await commitStudentImport(school.id, [
      { rowNumber: 2, data: { firstName: "Ade", lastName: "Bello" } },
      { rowNumber: 3, data: { admissionNumber: "DUP-001", firstName: "Chidi", lastName: "Okafor" } },
    ]);

    expect(outcome.created).toBe(1);
    expect(outcome.failed).toHaveLength(1);
    expect(outcome.failed[0].error).toMatch(/already in use/i);
  });

  it("stops importing once the plan's student limit is reached, keeping the rows already created", async () => {
    const { school } = await makeSchoolWithClass();
    const plan = await prisma.subscriptionPlan.create({
      data: { slug: `vitest-limit-${Date.now()}`, name: "Limit test", priceMonthlyMinor: 0, priceAnnualMinor: 0, currency: "NGN", studentLimit: 1 },
    });
    try {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      await prisma.subscription.create({
        data: { schoolId: school.id, planId: plan.id, status: "ACTIVE", billingInterval: "MONTHLY", currentPeriodStart: now, currentPeriodEnd: periodEnd },
      });

      const outcome = await commitStudentImport(school.id, [
        { rowNumber: 2, data: { firstName: "Ade", lastName: "Bello" } },
        { rowNumber: 3, data: { firstName: "Chidi", lastName: "Okafor" } },
      ]);

      expect(outcome.created).toBe(1);
      expect(outcome.failed).toHaveLength(1);
      expect(outcome.failed[0].error).toMatch(/limit/i);
    } finally {
      // Not covered by cleanupTestSchools (which only cascades from
      // School), and SubscriptionPlan has no test-slug sweep of its own.
      await prisma.subscription.deleteMany({ where: { planId: plan.id } });
      await prisma.subscriptionPlan.delete({ where: { id: plan.id } });
    }
  });
});
