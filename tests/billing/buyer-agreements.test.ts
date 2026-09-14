import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createTestBuyer, cleanupTestBuyers } from "../helpers/buyer-factories";
import {
  createBuyerAgreement,
  approveAndActivateBuyerAgreement,
  cancelBuyerAgreement,
  markBuyerAgreementCompleted,
  postBuyerProgressUpdate,
} from "@/lib/services/buyer-agreements";

afterAll(async () => {
  await cleanupTestBuyers();
});

describe("createBuyerAgreement", () => {
  it("creates a PENDING agreement", async () => {
    const { buyer, user: admin } = await createTestBuyer();
    const agreement = await createBuyerAgreement({ buyerId: buyer.id, agreementValueMinor: 300_000_000, createdById: admin.id });
    expect(agreement.status).toBe("PENDING");
    expect(agreement.progressStage).toBe("ORDER_CONFIRMED");
  });
});

describe("approveAndActivateBuyerAgreement", () => {
  it("activates a PENDING agreement atomically", async () => {
    const { buyer, user: admin } = await createTestBuyer();
    const agreement = await createBuyerAgreement({ buyerId: buyer.id, createdById: admin.id });

    const activated = await approveAndActivateBuyerAgreement({ agreementId: agreement.id, approvedById: admin.id });
    expect(activated.status).toBe("ACTIVE");
    expect(activated.approvedById).toBe(admin.id);
    expect(activated.startedAt).not.toBeNull();
  });

  it("rejects approving an agreement that isn't PENDING", async () => {
    const { buyer, user: admin } = await createTestBuyer();
    const agreement = await createBuyerAgreement({ buyerId: buyer.id, createdById: admin.id });
    await approveAndActivateBuyerAgreement({ agreementId: agreement.id, approvedById: admin.id });

    await expect(approveAndActivateBuyerAgreement({ agreementId: agreement.id, approvedById: admin.id })).rejects.toThrow();
  });

  it("only one ACTIVE agreement per Buyer at a time (partial unique index)", async () => {
    const { buyer, user: admin } = await createTestBuyer();
    const first = await createBuyerAgreement({ buyerId: buyer.id, createdById: admin.id });
    await approveAndActivateBuyerAgreement({ agreementId: first.id, approvedById: admin.id });

    const second = await createBuyerAgreement({ buyerId: buyer.id, createdById: admin.id });
    await expect(approveAndActivateBuyerAgreement({ agreementId: second.id, approvedById: admin.id })).rejects.toThrow();
  });
});

describe("cancelBuyerAgreement", () => {
  it("requires a reason and never touches an already-closed agreement", async () => {
    const { buyer, user: admin } = await createTestBuyer();
    const agreement = await createBuyerAgreement({ buyerId: buyer.id, createdById: admin.id });

    await expect(cancelBuyerAgreement({ agreementId: agreement.id, cancelledById: admin.id, reason: "" })).rejects.toThrow();

    const cancelled = await cancelBuyerAgreement({ agreementId: agreement.id, cancelledById: admin.id, reason: "Changed their mind" });
    expect(cancelled.status).toBe("CANCELLED");

    await expect(cancelBuyerAgreement({ agreementId: agreement.id, cancelledById: admin.id, reason: "again" })).rejects.toThrow();
  });
});

describe("markBuyerAgreementCompleted", () => {
  it("only completes an ACTIVE agreement", async () => {
    const { buyer, user: admin } = await createTestBuyer();
    const agreement = await createBuyerAgreement({ buyerId: buyer.id, createdById: admin.id });

    await expect(markBuyerAgreementCompleted({ agreementId: agreement.id, completedById: admin.id })).rejects.toThrow();

    await approveAndActivateBuyerAgreement({ agreementId: agreement.id, approvedById: admin.id });
    const completed = await markBuyerAgreementCompleted({ agreementId: agreement.id, completedById: admin.id });
    expect(completed.status).toBe("COMPLETED");
  });
});

describe("postBuyerProgressUpdate", () => {
  it("only posts progress on an ACTIVE agreement, and only moves forward", async () => {
    const { buyer, user: admin } = await createTestBuyer();
    const agreement = await createBuyerAgreement({ buyerId: buyer.id, createdById: admin.id });

    await expect(
      postBuyerProgressUpdate({ agreementId: agreement.id, stage: "IN_DEVELOPMENT", postedById: admin.id })
    ).rejects.toThrow();

    await approveAndActivateBuyerAgreement({ agreementId: agreement.id, approvedById: admin.id });

    const result = await postBuyerProgressUpdate({ agreementId: agreement.id, stage: "IN_DEVELOPMENT", note: "Build started", postedById: admin.id });
    expect(result.updatedAgreement.progressStage).toBe("IN_DEVELOPMENT");

    // Same stage again, or an earlier one, is refused.
    await expect(
      postBuyerProgressUpdate({ agreementId: agreement.id, stage: "IN_DEVELOPMENT", postedById: admin.id })
    ).rejects.toThrow();
    await expect(
      postBuyerProgressUpdate({ agreementId: agreement.id, stage: "ORDER_CONFIRMED", postedById: admin.id })
    ).rejects.toThrow();

    await postBuyerProgressUpdate({ agreementId: agreement.id, stage: "INSTALLATION", postedById: admin.id });
    await postBuyerProgressUpdate({ agreementId: agreement.id, stage: "DELIVERED", postedById: admin.id });

    const finalAgreement = await prisma.buyerAgreement.findUniqueOrThrow({ where: { id: agreement.id } });
    expect(finalAgreement.progressStage).toBe("DELIVERED");

    const log = await prisma.buyerProgressUpdate.findMany({ where: { buyerAgreementId: agreement.id } });
    expect(log).toHaveLength(3);
  });
});
