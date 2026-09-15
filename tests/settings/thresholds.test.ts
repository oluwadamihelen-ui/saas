import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { thresholdsSchema } from "@/app/dashboard/settings/thresholds-schema";
import { toMinorUnits } from "@/lib/money";
import { createSchoolWithOwner } from "@/lib/school-provisioning";
import { cleanupTestSchools } from "../helpers/factories";

afterAll(cleanupTestSchools);

const VALID_INPUT = {
  expenseApprovalThreshold: "600000",
  performancePassMark: "55",
  performanceSignificantChangePoints: "12",
  attendanceConcernThreshold: "75",
  performanceFailedSubjectConcernThreshold: "3",
  healthScoreWeightAcademic: "40",
  healthScoreWeightAttendance: "20",
  healthScoreWeightFinancial: "20",
  healthScoreWeightOperational: "20",
};

describe("Threshold settings — validation", () => {
  it("accepts a well-formed set of thresholds whose health score weights sum to 100", () => {
    const parsed = thresholdsSchema.safeParse(VALID_INPUT);
    expect(parsed.success).toBe(true);
  });

  it("rejects health score weights that don't add up to 100", () => {
    const parsed = thresholdsSchema.safeParse({ ...VALID_INPUT, healthScoreWeightOperational: "21" });
    expect(parsed.success).toBe(false);
  });

  it("rejects a performance pass mark outside 0-100", () => {
    const parsed = thresholdsSchema.safeParse({ ...VALID_INPUT, performancePassMark: "150" });
    expect(parsed.success).toBe(false);
  });

  it("rejects a negative expense approval threshold", () => {
    const parsed = thresholdsSchema.safeParse({ ...VALID_INPUT, expenseApprovalThreshold: "-1" });
    expect(parsed.success).toBe(false);
  });

  it("converts the major-unit expense threshold to minor units the same way money.ts does everywhere else", () => {
    const parsed = thresholdsSchema.parse(VALID_INPUT);
    expect(toMinorUnits(parsed.expenseApprovalThreshold)).toBe(60_000_000);
  });
});

describe("Threshold settings — a freshly provisioned school keeps the documented defaults", () => {
  it("matches the schema doc comments until an owner explicitly changes them", async () => {
    const schoolName = `vitest-thresholds-${Date.now()}`;
    await createSchoolWithOwner({
      schoolName,
      ownerName: "Test Owner",
      ownerEmail: `owner-${schoolName}@example.com`,
      password: "Passw0rd!23",
    });
    const school = await prisma.school.findUniqueOrThrow({ where: { slug: schoolName } });

    expect(school.expenseApprovalThresholdMinor).toBe(50_000_000);
    expect(school.performancePassMark).toBe(50);
    expect(school.performanceSignificantChangePoints).toBe(10);
    expect(school.attendanceConcernThreshold).toBe(80);
    expect(school.performanceFailedSubjectConcernThreshold).toBe(2);
    expect(
      school.healthScoreWeightAcademic +
        school.healthScoreWeightAttendance +
        school.healthScoreWeightFinancial +
        school.healthScoreWeightOperational
    ).toBe(100);
  });
});
