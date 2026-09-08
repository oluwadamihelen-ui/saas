import { describe, it, expect, afterAll } from "vitest";
import {
  hasFeature,
  getStudentLimit,
  getActiveStudentCount,
  requireStudentCapacity,
  getEffectiveSubscription,
  StudentLimitError,
} from "@/lib/billing/entitlements";
import { createTestSchool, createTestStudents, cleanupTestSchools } from "../helpers/factories";

afterAll(cleanupTestSchools);

describe("student limit boundaries", () => {
  it("Starter (150) allows the 150th student and blocks the 151st", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    await createTestStudents(school.id, 149);

    // 150th enrollment: at 149 active, capacity check must pass.
    await expect(requireStudentCapacity(school.id)).resolves.toBeUndefined();
    await createTestStudents(school.id, 1); // now at 150

    // 151st enrollment: at 150 active (== limit), must be blocked.
    await expect(requireStudentCapacity(school.id)).rejects.toBeInstanceOf(StudentLimitError);
  });

  it("Professional (500) allows the 500th student and blocks the 501st", async () => {
    const { school } = await createTestSchool({ planTier: "PROFESSIONAL" });
    await createTestStudents(school.id, 499);
    await expect(requireStudentCapacity(school.id)).resolves.toBeUndefined();
    await createTestStudents(school.id, 1);
    await expect(requireStudentCapacity(school.id)).rejects.toBeInstanceOf(StudentLimitError);
  });

  it("Enterprise (unlimited) never blocks", async () => {
    const { school } = await createTestSchool({ planTier: "ENTERPRISE" });
    await createTestStudents(school.id, 3000);
    await expect(requireStudentCapacity(school.id)).resolves.toBeUndefined();
  });

  it("only ACTIVE and SUSPENDED students count against the limit", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { prisma } = await import("@/lib/db");
    await createTestStudents(school.id, 5);
    await prisma.student.createMany({
      data: [
        { schoolId: school.id, firstName: "G", lastName: "Rad", admissionNumber: "grad-1", status: "GRADUATED" },
        { schoolId: school.id, firstName: "W", lastName: "Draw", admissionNumber: "withdraw-1", status: "WITHDRAWN" },
      ],
    });
    expect(await getActiveStudentCount(school.id)).toBe(5);
  });

  it("a school with no subscription row is not blocked (fail-open, legacy-safe)", async () => {
    const { prisma } = await import("@/lib/db");
    const school = await prisma.school.create({ data: { name: "vitest-no-sub", slug: `vitest-no-sub-${Date.now()}`, status: "ACTIVE" } });
    expect(await getStudentLimit(school.id)).toBeNull();
    await expect(requireStudentCapacity(school.id)).resolves.toBeUndefined();
    await prisma.school.delete({ where: { id: school.id } });
  });
});

describe("feature access per tier", () => {
  it("Starter has student_management but not finance or admissions", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    expect(await hasFeature(school.id, "student_management")).toBe(true);
    expect(await hasFeature(school.id, "finance")).toBe(false);
    expect(await hasFeature(school.id, "admissions")).toBe(false);
  });

  it("Professional has finance/admissions but not payroll or library (Premium-only)", async () => {
    const { school } = await createTestSchool({ planTier: "PROFESSIONAL" });
    expect(await hasFeature(school.id, "finance")).toBe(true);
    expect(await hasFeature(school.id, "admissions")).toBe(true);
    expect(await hasFeature(school.id, "payroll")).toBe(false);
    expect(await hasFeature(school.id, "library")).toBe(false);
  });

  it("Premium has every Professional feature plus payroll/library/transport/hostel", async () => {
    const { school } = await createTestSchool({ planTier: "PREMIUM" });
    expect(await hasFeature(school.id, "finance")).toBe(true);
    expect(await hasFeature(school.id, "payroll")).toBe(true);
    expect(await hasFeature(school.id, "library")).toBe(true);
    expect(await hasFeature(school.id, "transport")).toBe(true);
    expect(await hasFeature(school.id, "hostel")).toBe(true);
  });

  it("a CANCELED subscription loses feature access even though the plan would otherwise grant it", async () => {
    const { school } = await createTestSchool({ planTier: "PREMIUM", status: "CANCELED" });
    expect(await hasFeature(school.id, "finance")).toBe(false);
  });

  it("a PAST_DUE subscription keeps feature access (grace period)", async () => {
    const { school } = await createTestSchool({ planTier: "PROFESSIONAL", status: "PAST_DUE" });
    expect(await hasFeature(school.id, "finance")).toBe(true);
  });

  it("a school with no subscription row has no premium features (fail-closed)", async () => {
    const { prisma } = await import("@/lib/db");
    const school = await prisma.school.create({ data: { name: "vitest-no-sub-2", slug: `vitest-no-sub-2-${Date.now()}`, status: "ACTIVE" } });
    expect(await hasFeature(school.id, "finance")).toBe(false);
    await prisma.school.delete({ where: { id: school.id } });
  });
});

describe("cross-school security", () => {
  it("one school's student count and limit never reflect another school's data", async () => {
    const a = await createTestSchool({ planTier: "STARTER" });
    const b = await createTestSchool({ planTier: "PREMIUM" });
    await createTestStudents(a.school.id, 10);
    await createTestStudents(b.school.id, 3);

    expect(await getActiveStudentCount(a.school.id)).toBe(10);
    expect(await getActiveStudentCount(b.school.id)).toBe(3);
    expect(await getStudentLimit(a.school.id)).toBe(150);
    expect(await getStudentLimit(b.school.id)).toBe(1_500);
  });

  it("one school's feature access is independent of another's plan", async () => {
    const starter = await createTestSchool({ planTier: "STARTER" });
    const premium = await createTestSchool({ planTier: "PREMIUM" });
    expect(await hasFeature(starter.school.id, "payroll")).toBe(false);
    expect(await hasFeature(premium.school.id, "payroll")).toBe(true);
  });
});

describe("trial lifecycle", () => {
  it("an active trial reports isTrialing and days remaining, with Professional-tier access", async () => {
    const trialEnd = new Date(Date.now() + 5 * 86_400_000);
    const { school } = await createTestSchool({ planTier: "PROFESSIONAL", status: "TRIALING", trialStart: new Date(), trialEnd });
    const effective = await getEffectiveSubscription(school.id);
    expect(effective?.isTrialing).toBe(true);
    expect(effective?.trialDaysRemaining).toBeGreaterThanOrEqual(4);
    expect(await hasFeature(school.id, "finance")).toBe(true);
  });

  it("a trial past its trialEnd is lazily reconciled to EXPIRED and loses feature access", async () => {
    const pastTrialEnd = new Date(Date.now() - 60_000);
    const { school } = await createTestSchool({
      planTier: "PROFESSIONAL",
      status: "TRIALING",
      trialStart: new Date(Date.now() - 15 * 86_400_000),
      trialEnd: pastTrialEnd,
    });
    const effective = await getEffectiveSubscription(school.id);
    expect(effective?.effectiveStatus).toBe("EXPIRED");
    expect(await hasFeature(school.id, "finance")).toBe(false);

    const { prisma } = await import("@/lib/db");
    const persisted = await prisma.subscription.findUnique({ where: { schoolId: school.id } });
    expect(persisted?.status).toBe("EXPIRED");
  });

  it("an ACTIVE subscription past its currentPeriodEnd is reconciled to PAST_DUE with a grace window", async () => {
    const { school } = await createTestSchool({
      planTier: "STARTER",
      status: "ACTIVE",
      currentPeriodStart: new Date(Date.now() - 40 * 86_400_000),
      currentPeriodEnd: new Date(Date.now() - 60_000),
    });
    const effective = await getEffectiveSubscription(school.id);
    expect(effective?.effectiveStatus).toBe("PAST_DUE");

    const { prisma } = await import("@/lib/db");
    const persisted = await prisma.subscription.findUnique({ where: { schoolId: school.id } });
    expect(persisted?.graceEndsAt).not.toBeNull();
  });
});
