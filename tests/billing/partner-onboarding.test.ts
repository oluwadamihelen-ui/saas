import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { cleanupTestPartners, createTestPartner } from "../helpers/partner-factories";
import {
  applyAsPartner,
  approvePartnerApplication,
  rejectPartnerApplication,
  suspendPartner,
  reactivatePartner,
} from "@/lib/services/partner-onboarding";

afterAll(async () => {
  await cleanupTestPartners();
  // applyAsPartner-created users don't match the vitest-partner- prefix
  // cleanupTestPartners looks for, since it generates its own email —
  // cleaned up here directly instead.
  const users = await prisma.user.findMany({ where: { email: { startsWith: "vitest-apply-" } }, select: { id: true } });
  const partners = await prisma.partner.findMany({ where: { userId: { in: users.map((u) => u.id) } }, select: { id: true } });
  await prisma.partner.deleteMany({ where: { id: { in: partners.map((p) => p.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
});

describe("applyAsPartner", () => {
  it("creates a User+Partner pair immediately at PENDING", async () => {
    const email = `vitest-apply-${Date.now()}@example.com`;
    const { user, partner } = await applyAsPartner({ displayName: "Jane Partner", email, password: "supersecret123" });
    expect(user.schoolId).toBeNull();
    expect(partner.status).toBe("PENDING");
    expect(partner.userId).toBe(user.id);
  });

  it("refuses a duplicate email", async () => {
    const email = `vitest-apply-${Date.now()}@example.com`;
    await applyAsPartner({ displayName: "Jane Partner", email, password: "supersecret123" });
    await expect(applyAsPartner({ displayName: "Jane Again", email, password: "supersecret123" })).rejects.toThrow();
  });
});

describe("Partner status lifecycle", () => {
  it("approve: PENDING -> ACTIVE only", async () => {
    const { partner, user: admin } = await createTestPartner({ status: "PENDING" });
    const approved = await approvePartnerApplication(partner.id, admin.id);
    expect(approved.status).toBe("ACTIVE");
    await expect(approvePartnerApplication(partner.id, admin.id)).rejects.toThrow();
  });

  it("reject requires a reason and only applies to PENDING", async () => {
    const { partner, user: admin } = await createTestPartner({ status: "PENDING" });
    await expect(rejectPartnerApplication(partner.id, admin.id, "")).rejects.toThrow();
    const rejected = await rejectPartnerApplication(partner.id, admin.id, "Not a fit");
    expect(rejected.status).toBe("REJECTED");
    await expect(rejectPartnerApplication(partner.id, admin.id, "again")).rejects.toThrow();
  });

  it("suspend requires a reason and only applies to ACTIVE; reactivate only applies to SUSPENDED", async () => {
    const { partner, user: admin } = await createTestPartner({ status: "ACTIVE" });
    await expect(suspendPartner(partner.id, admin.id, "")).rejects.toThrow();
    const suspended = await suspendPartner(partner.id, admin.id, "Policy violation");
    expect(suspended.status).toBe("SUSPENDED");

    await expect(reactivatePartner(partner.id, admin.id)).resolves.toMatchObject({ status: "ACTIVE" });
    await expect(reactivatePartner(partner.id, admin.id)).rejects.toThrow();
  });
});
