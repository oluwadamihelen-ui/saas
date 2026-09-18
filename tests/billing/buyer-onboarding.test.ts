import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createTestBuyer, cleanupTestBuyers } from "../helpers/buyer-factories";
import { createEnterpriseInquiry } from "@/lib/services/enterprise-inquiries";
import { convertInquiryToBuyer, suspendBuyer, reactivateBuyer } from "@/lib/services/buyer-onboarding";

afterAll(async () => {
  await cleanupTestBuyers();
});

async function makeInquiry() {
  const suffix = `${Date.now()}-${Math.random()}`;
  return createEnterpriseInquiry({
    schoolOrGroupName: `Vitest Buyer Co ${suffix}`,
    contactName: `Vitest Contact ${suffix}`,
    email: `vitest-buyer-${suffix}@example.com`,
    phone: "+2340000000000",
  });
}

describe("convertInquiryToBuyer", () => {
  it("creates a schoolless User+Buyer, marks the inquiry CONVERTED, and returns a one-time temporary password", async () => {
    const inquiry = await makeInquiry();
    const admin = (await createTestBuyer()).user; // stand-in "Super Admin" actor id — only the id is used below

    const result = await convertInquiryToBuyer({ inquiryId: inquiry.id, createdById: admin.id, displayName: "Acme School Group", phone: "+2348000000" });
    expect(result.user.schoolId).toBeNull();
    expect(result.buyer.sourceInquiryId).toBe(inquiry.id);
    expect(result.temporaryPassword).toHaveLength(16);

    const updatedInquiry = await prisma.enterpriseInquiry.findUniqueOrThrow({ where: { id: inquiry.id } });
    expect(updatedInquiry.status).toBe("CONVERTED");
  });

  it("refuses to convert the same inquiry twice", async () => {
    const inquiry = await makeInquiry();
    const admin = (await createTestBuyer()).user;

    await convertInquiryToBuyer({ inquiryId: inquiry.id, createdById: admin.id, displayName: "Acme" });
    await expect(convertInquiryToBuyer({ inquiryId: inquiry.id, createdById: admin.id, displayName: "Acme Again" })).rejects.toThrow();
  });

  it("refuses a duplicate email", async () => {
    const { inquiry: existingInquiry } = await createTestBuyer();
    const secondInquiry = await createEnterpriseInquiry({
      schoolOrGroupName: "Dup Co",
      contactName: "Dup Contact",
      email: existingInquiry.email,
      phone: "+2340000000000",
    });
    const admin = (await createTestBuyer()).user;

    await expect(convertInquiryToBuyer({ inquiryId: secondInquiry.id, createdById: admin.id, displayName: "Dup" })).rejects.toThrow();
  });
});

describe("Buyer status lifecycle", () => {
  it("suspend requires a reason and only applies to ACTIVE; reactivate only applies to SUSPENDED", async () => {
    const { buyer, user: admin } = await createTestBuyer();

    await expect(suspendBuyer(buyer.id, admin.id, "")).rejects.toThrow();
    const suspended = await suspendBuyer(buyer.id, admin.id, "Deal fell through");
    expect(suspended.status).toBe("SUSPENDED");

    await expect(reactivateBuyer(buyer.id, admin.id)).resolves.toMatchObject({ status: "ACTIVE" });
    await expect(reactivateBuyer(buyer.id, admin.id)).rejects.toThrow();
  });
});
