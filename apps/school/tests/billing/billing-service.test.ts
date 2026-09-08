import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { changePlanSelfServe, cancelSubscriptionSelfServe, reactivateSubscriptionSelfServe, DowngradeBlockedError } from "@/lib/services/billing";
import { createTestSchool, createTestStudents, cleanupTestSchools, ensureTestPlans } from "../helpers/factories";

afterAll(cleanupTestSchools);

describe("changePlanSelfServe", () => {
  it("upgrades a school from Starter to Premium", async () => {
    const { school, plan: starter } = await createTestSchool({ planTier: "STARTER" });
    const plans = await ensureTestPlans();
    const premium = plans.find((p) => p.slug === "PREMIUM")!;

    const updated = await changePlanSelfServe(school.id, premium.id, "MONTHLY");
    expect(updated.planId).toBe(premium.id);
    expect(updated.planId).not.toBe(starter.id);
  });

  it("downgrades a school when it fits under the new plan's limit", async () => {
    const { school } = await createTestSchool({ planTier: "PREMIUM" });
    await createTestStudents(school.id, 50);
    const plans = await ensureTestPlans();
    const starter = plans.find((p) => p.slug === "STARTER")!;

    const updated = await changePlanSelfServe(school.id, starter.id, "MONTHLY");
    expect(updated.planId).toBe(starter.id);
  });

  it("blocks a downgrade that would drop the school under its active student count, and never touches any student", async () => {
    const { school } = await createTestSchool({ planTier: "PREMIUM" });
    await createTestStudents(school.id, 200); // over Starter's 150 limit
    const plans = await ensureTestPlans();
    const starter = plans.find((p) => p.slug === "STARTER")!;

    await expect(changePlanSelfServe(school.id, starter.id, "MONTHLY")).rejects.toBeInstanceOf(DowngradeBlockedError);

    const stillPremium = await prisma.subscription.findUnique({ where: { schoolId: school.id } });
    expect(stillPremium?.planId).not.toBe(starter.id);

    const studentCount = await prisma.student.count({ where: { schoolId: school.id, status: "ACTIVE" } });
    expect(studentCount).toBe(200); // downgrade-never-deletes
  });

  it("converts a TRIALING subscription to ACTIVE with a fresh billing period when a plan is chosen", async () => {
    const trialEnd = new Date(Date.now() + 5 * 86_400_000);
    const { school } = await createTestSchool({ planTier: "PROFESSIONAL", status: "TRIALING", trialStart: new Date(), trialEnd });
    const plans = await ensureTestPlans();
    const professional = plans.find((p) => p.slug === "PROFESSIONAL")!;

    const updated = await changePlanSelfServe(school.id, professional.id, "MONTHLY");
    expect(updated.status).toBe("ACTIVE");
  });

  it("voids any still-outstanding PENDING invoice from before the change rather than leaving two", async () => {
    const { school, subscription } = await createTestSchool({ planTier: "STARTER" });
    await prisma.platformInvoice.create({
      data: {
        schoolId: school.id,
        subscriptionId: subscription.id,
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
        amountMinor: 25_000_00,
        dueDate: subscription.currentPeriodEnd,
        status: "PENDING",
      },
    });
    const plans = await ensureTestPlans();
    const premium = plans.find((p) => p.slug === "PREMIUM")!;
    await changePlanSelfServe(school.id, premium.id, "MONTHLY");

    const invoices = await prisma.platformInvoice.findMany({ where: { schoolId: school.id }, orderBy: { createdAt: "asc" } });
    expect(invoices).toHaveLength(2);
    expect(invoices[0].status).toBe("VOID");
    expect(invoices[1].status).toBe("PENDING");
  });
});

describe("cancelSubscriptionSelfServe", () => {
  it("marks the subscription CANCELED and keeps the school's data intact", async () => {
    const { school } = await createTestSchool({ planTier: "PROFESSIONAL" });
    await createTestStudents(school.id, 20);

    const updated = await cancelSubscriptionSelfServe(school.id);
    expect(updated.status).toBe("CANCELED");
    expect(updated.canceledAt).not.toBeNull();

    const studentCount = await prisma.student.count({ where: { schoolId: school.id } });
    expect(studentCount).toBe(20);
    const schoolStillExists = await prisma.school.findUnique({ where: { id: school.id } });
    expect(schoolStillExists).not.toBeNull();
  });
});

describe("reactivateSubscriptionSelfServe", () => {
  it("restores a CANCELED subscription to ACTIVE with a fresh period", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER", status: "CANCELED" });
    const updated = await reactivateSubscriptionSelfServe(school.id, "MONTHLY");
    expect(updated.status).toBe("ACTIVE");
    expect(updated.canceledAt).toBeNull();
  });

  it("refuses to reactivate a subscription that is already active", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER", status: "ACTIVE" });
    await expect(reactivateSubscriptionSelfServe(school.id, "MONTHLY")).rejects.toThrow();
  });
});
