import "server-only";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { reconcilePartnerCommissions, getPartnerCommissionConfig } from "@/lib/services/partner-commissions";

/// Manual payout only in V1 — no automatic bank transfer. A withdrawal
/// request always covers the Partner's *entire* currently-AVAILABLE
/// balance at request time (never a partner-chosen partial amount) — this
/// sidesteps needing to split a single commission across two withdrawals,
/// keeping commissionId a clean one-to-one with, at most, one withdrawal
/// ever (see PartnerWithdrawalAllocation's own doc comment).
export async function requestWithdrawal(partnerId: string) {
  await reconcilePartnerCommissions(partnerId);

  const available = await prisma.partnerCommission.findMany({
    where: { partnerId, status: "AVAILABLE" },
    select: { id: true, commissionAmountMinor: true },
  });
  if (available.length === 0) throw new Error("You have no available balance to withdraw.");

  const amountMinor = available.reduce((sum, c) => sum + c.commissionAmountMinor, 0);
  const config = await getPartnerCommissionConfig();
  if (amountMinor < config.minimumWithdrawalMinor) {
    throw new Error(`Your available balance is below the minimum withdrawal amount.`);
  }

  const commissionIds = available.map((c) => c.id);

  const withdrawal = await prisma.$transaction(async (tx) => {
    // The conditional WHERE status:'AVAILABLE' guard is what makes this
    // safe against a second, concurrent withdrawal request racing this one
    // for the same commissions — if anything else already moved one of
    // these rows off AVAILABLE between our read above and this update, the
    // count comes back short and the whole transaction is rolled back
    // rather than double-allocating it.
    const reserved = await tx.partnerCommission.updateMany({
      where: { id: { in: commissionIds }, status: "AVAILABLE" },
      data: { status: "RESERVED" },
    });
    if (reserved.count !== commissionIds.length) {
      throw new Error("Your available balance just changed — please try again.");
    }

    const created = await tx.partnerWithdrawal.create({
      data: { partnerId, amountMinor, currency: "NGN" },
    });

    // commissionId is this table's own primary key — a second attempt to
    // allocate an already-allocated commission (one that slipped past the
    // guard above somehow) fails here at the database level instead.
    await tx.partnerWithdrawalAllocation.createMany({
      data: commissionIds.map((commissionId) => ({ withdrawalId: created.id, commissionId })),
    });

    return created;
  });

  const partner = await prisma.partner.findUniqueOrThrow({ where: { id: partnerId } });
  await logAudit({
    schoolId: null,
    userId: partner.userId,
    action: "partner_withdrawal.requested",
    resourceType: "PartnerWithdrawal",
    resourceId: withdrawal.id,
    newValue: { amountMinor, commissionCount: commissionIds.length },
  });

  return withdrawal;
}

/// Releases every allocation on a withdrawal back to AVAILABLE — the
/// shared undo step behind both rejecting and cancelling a still-open
/// request. Never called on an already-APPROVED/PAID withdrawal (those
/// keep their allocations permanently, see the model's own doc comment).
async function releaseWithdrawalAllocations(withdrawalId: string) {
  await prisma.$transaction(async (tx) => {
    const allocations = await tx.partnerWithdrawalAllocation.findMany({ where: { withdrawalId }, select: { commissionId: true } });
    await tx.partnerWithdrawalAllocation.deleteMany({ where: { withdrawalId } });
    await tx.partnerCommission.updateMany({
      where: { id: { in: allocations.map((a) => a.commissionId) } },
      data: { status: "AVAILABLE" },
    });
  });
}

export async function markWithdrawalUnderReview(withdrawalId: string, reviewedById: string) {
  const withdrawal = await prisma.partnerWithdrawal.findUnique({ where: { id: withdrawalId } });
  if (!withdrawal) throw new Error("Withdrawal not found.");
  if (withdrawal.status !== "REQUESTED") throw new Error("Only a newly requested withdrawal can be moved to under review.");

  const updated = await prisma.partnerWithdrawal.update({
    where: { id: withdrawalId },
    data: { status: "UNDER_REVIEW", reviewedAt: new Date(), reviewedById },
  });
  await logAudit({ schoolId: null, userId: reviewedById, action: "partner_withdrawal.under_review", resourceType: "PartnerWithdrawal", resourceId: withdrawalId });
  return updated;
}

export async function approveWithdrawal(withdrawalId: string, reviewedById: string) {
  const withdrawal = await prisma.partnerWithdrawal.findUnique({ where: { id: withdrawalId } });
  if (!withdrawal) throw new Error("Withdrawal not found.");
  if (withdrawal.status !== "REQUESTED" && withdrawal.status !== "UNDER_REVIEW") {
    throw new Error("Only a requested or under-review withdrawal can be approved.");
  }

  const updated = await prisma.partnerWithdrawal.update({
    where: { id: withdrawalId },
    data: { status: "APPROVED", reviewedAt: new Date(), reviewedById },
  });
  await logAudit({ schoolId: null, userId: reviewedById, action: "partner_withdrawal.approved", resourceType: "PartnerWithdrawal", resourceId: withdrawalId });
  return updated;
}

export async function rejectWithdrawal(withdrawalId: string, reviewedById: string, reason: string) {
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new Error("A reason is required to reject a withdrawal.");

  const withdrawal = await prisma.partnerWithdrawal.findUnique({ where: { id: withdrawalId } });
  if (!withdrawal) throw new Error("Withdrawal not found.");
  if (withdrawal.status !== "REQUESTED" && withdrawal.status !== "UNDER_REVIEW") {
    throw new Error("Only a requested or under-review withdrawal can be rejected.");
  }

  await releaseWithdrawalAllocations(withdrawalId);
  const updated = await prisma.partnerWithdrawal.update({
    where: { id: withdrawalId },
    data: { status: "REJECTED", reviewedAt: new Date(), reviewedById, rejectionReason: trimmedReason },
  });
  await logAudit({
    schoolId: null,
    userId: reviewedById,
    action: "partner_withdrawal.rejected",
    resourceType: "PartnerWithdrawal",
    resourceId: withdrawalId,
    newValue: { reason: trimmedReason },
  });
  return updated;
}

/// Partner-initiated — distinct from Super Admin rejection (see
/// PartnerWithdrawalStatus's own CANCELLED vs REJECTED members).
export async function cancelWithdrawal(withdrawalId: string, partnerId: string) {
  const withdrawal = await prisma.partnerWithdrawal.findUnique({ where: { id: withdrawalId } });
  if (!withdrawal) throw new Error("Withdrawal not found.");
  if (withdrawal.partnerId !== partnerId) throw new Error("This withdrawal does not belong to you.");
  if (withdrawal.status !== "REQUESTED" && withdrawal.status !== "UNDER_REVIEW") {
    throw new Error("This withdrawal can no longer be cancelled.");
  }

  await releaseWithdrawalAllocations(withdrawalId);
  const updated = await prisma.partnerWithdrawal.update({ where: { id: withdrawalId }, data: { status: "CANCELLED" } });

  const partner = await prisma.partner.findUniqueOrThrow({ where: { id: partnerId } });
  await logAudit({ schoolId: null, userId: partner.userId, action: "partner_withdrawal.cancelled", resourceType: "PartnerWithdrawal", resourceId: withdrawalId });
  return updated;
}

/// Manual payout — a Super Admin pays the Partner outside this app (bank
/// transfer, etc.) and records the reference here. Allocated commissions
/// move from RESERVED to PAID permanently; this withdrawal's allocations
/// are never released after this point.
export async function markWithdrawalPaid(withdrawalId: string, paidById: string, payoutReference: string, notes?: string) {
  const withdrawal = await prisma.partnerWithdrawal.findUnique({ where: { id: withdrawalId }, include: { allocations: true } });
  if (!withdrawal) throw new Error("Withdrawal not found.");
  if (withdrawal.status !== "APPROVED") throw new Error("Only an approved withdrawal can be marked paid.");

  const reference = payoutReference.trim();
  if (!reference) throw new Error("A payout reference is required.");

  const updated = await prisma.$transaction(async (tx) => {
    await tx.partnerCommission.updateMany({
      where: { id: { in: withdrawal.allocations.map((a) => a.commissionId) } },
      data: { status: "PAID" },
    });
    return tx.partnerWithdrawal.update({
      where: { id: withdrawalId },
      data: { status: "PAID", paidAt: new Date(), paidById, payoutReference: reference, notes: notes?.trim() || null },
    });
  });

  await logAudit({
    schoolId: null,
    userId: paidById,
    action: "partner_withdrawal.paid",
    resourceType: "PartnerWithdrawal",
    resourceId: withdrawalId,
    newValue: { payoutReference: reference },
  });
  return updated;
}

export async function listWithdrawalsForPlatform() {
  return prisma.partnerWithdrawal.findMany({
    include: { partner: true },
    orderBy: { requestedAt: "desc" },
  });
}

export async function getPartnerBalance(partnerId: string) {
  await reconcilePartnerCommissions(partnerId);
  const [available, pending, lifetime] = await Promise.all([
    prisma.partnerCommission.aggregate({ where: { partnerId, status: "AVAILABLE" }, _sum: { commissionAmountMinor: true } }),
    prisma.partnerCommission.aggregate({ where: { partnerId, status: "PENDING" }, _sum: { commissionAmountMinor: true } }),
    prisma.partnerCommission.aggregate({
      where: { partnerId, status: { in: ["AVAILABLE", "RESERVED", "PAID"] } },
      _sum: { commissionAmountMinor: true },
    }),
  ]);
  return {
    availableMinor: available._sum.commissionAmountMinor ?? 0,
    pendingMinor: pending._sum.commissionAmountMinor ?? 0,
    lifetimeEarnedMinor: lifetime._sum.commissionAmountMinor ?? 0,
  };
}
