import "server-only";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { BuyerProgressStage, PaymentArrangement } from "@/generated/prisma/client";

export async function createBuyerAgreement(input: {
  buyerId: string;
  agreementValueMinor?: number | null;
  currency?: string;
  paymentArrangement?: PaymentArrangement | null;
  createdById: string;
}) {
  const agreement = await prisma.buyerAgreement.create({
    data: {
      buyerId: input.buyerId,
      agreementValueMinor: input.agreementValueMinor ?? null,
      currency: input.currency ?? "NGN",
      paymentArrangement: input.paymentArrangement ?? null,
      createdById: input.createdById,
    },
  });

  await logAudit({
    schoolId: null,
    userId: input.createdById,
    action: "buyer_agreement.created",
    resourceType: "BuyerAgreement",
    resourceId: agreement.id,
    newValue: { buyerId: input.buyerId },
  });

  return agreement;
}

/// Approving a PENDING agreement activates it atomically — same
/// PENDING-can-never-be-operative rule as CommercialAgreement, just
/// without a RENT relationship to ever supersede (a Buyer never rents).
export async function approveAndActivateBuyerAgreement(input: { agreementId: string; approvedById: string }) {
  const agreement = await prisma.buyerAgreement.findUnique({ where: { id: input.agreementId } });
  if (!agreement) throw new Error("Buyer agreement not found.");
  if (agreement.status !== "PENDING") throw new Error("Only a PENDING agreement can be approved.");

  const now = new Date();
  const activated = await prisma.buyerAgreement.update({
    where: { id: agreement.id },
    data: { status: "ACTIVE", approvedAt: now, approvedById: input.approvedById, startedAt: now, activatedById: input.approvedById },
  });

  await logAudit({
    schoolId: null,
    userId: input.approvedById,
    action: "buyer_agreement.approved_and_activated",
    resourceType: "BuyerAgreement",
    resourceId: agreement.id,
  });

  return activated;
}

export async function cancelBuyerAgreement(input: { agreementId: string; cancelledById: string; reason: string }) {
  const reason = input.reason.trim();
  if (!reason) throw new Error("A reason is required to cancel a Buyer agreement.");

  const agreement = await prisma.buyerAgreement.findUnique({ where: { id: input.agreementId } });
  if (!agreement) throw new Error("Buyer agreement not found.");
  if (agreement.status === "COMPLETED" || agreement.status === "CANCELLED") {
    throw new Error("This agreement is already closed.");
  }

  const now = new Date();
  const updated = await prisma.buyerAgreement.update({
    where: { id: input.agreementId },
    data: { status: "CANCELLED", cancelledAt: now, cancelledById: input.cancelledById, cancellationReason: reason, endedAt: now },
  });

  await logAudit({
    schoolId: null,
    userId: input.cancelledById,
    action: "buyer_agreement.cancelled",
    resourceType: "BuyerAgreement",
    resourceId: agreement.id,
    newValue: { reason },
  });

  return updated;
}

export async function markBuyerAgreementCompleted(input: { agreementId: string; completedById: string }) {
  const agreement = await prisma.buyerAgreement.findUnique({ where: { id: input.agreementId } });
  if (!agreement) throw new Error("Buyer agreement not found.");
  if (agreement.status !== "ACTIVE") throw new Error("Only an ACTIVE agreement can be marked completed.");

  const now = new Date();
  const updated = await prisma.buyerAgreement.update({
    where: { id: input.agreementId },
    data: { status: "COMPLETED", completedAt: now, completedById: input.completedById, endedAt: now },
  });

  await logAudit({
    schoolId: null,
    userId: input.completedById,
    action: "buyer_agreement.completed",
    resourceType: "BuyerAgreement",
    resourceId: agreement.id,
  });

  return updated;
}

const STAGE_ORDER: BuyerProgressStage[] = ["ORDER_CONFIRMED", "IN_DEVELOPMENT", "INSTALLATION", "DELIVERED"];

/// The build/installation "progress report" a Buyer sees — each call
/// appends a log row and advances the agreement's own current stage.
/// Stages only ever move forward; this is a report of real progress, not a
/// free-form status field a Super Admin could accidentally rewind.
export async function postBuyerProgressUpdate(input: { agreementId: string; stage: BuyerProgressStage; note?: string | null; postedById: string }) {
  const agreement = await prisma.buyerAgreement.findUnique({ where: { id: input.agreementId } });
  if (!agreement) throw new Error("Buyer agreement not found.");
  if (agreement.status !== "ACTIVE") throw new Error("Progress can only be posted on an ACTIVE agreement.");

  const currentIndex = STAGE_ORDER.indexOf(agreement.progressStage);
  const newIndex = STAGE_ORDER.indexOf(input.stage);
  if (newIndex <= currentIndex) {
    throw new Error(`Progress can only move forward — this agreement is already at or past ${agreement.progressStage}.`);
  }

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const update = await tx.buyerProgressUpdate.create({
      data: { buyerAgreementId: agreement.id, stage: input.stage, note: input.note?.trim() || null, postedById: input.postedById, postedAt: now },
    });
    const updatedAgreement = await tx.buyerAgreement.update({
      where: { id: agreement.id },
      data: { progressStage: input.stage },
    });
    return { update, updatedAgreement };
  });

  await logAudit({
    schoolId: null,
    userId: input.postedById,
    action: "buyer_agreement.progress_posted",
    resourceType: "BuyerAgreement",
    resourceId: agreement.id,
    newValue: { stage: input.stage },
  });

  return result;
}
