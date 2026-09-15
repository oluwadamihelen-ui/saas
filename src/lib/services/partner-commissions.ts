import "server-only";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { ensurePartnerCommissionConfig } from "@/lib/platform-provisioning";
import { Prisma } from "@/generated/prisma/client";
import type { PartnerCommission, PartnerCommissionPolicy } from "@/generated/prisma/client";

/// Lazily seeds (if missing) and returns the one PartnerCommissionConfig
/// row — same "no cron, no separate boot step" reasoning as every other
/// lazy-reconciliation pattern in this codebase (see entitlements.ts).
export async function getPartnerCommissionConfig() {
  return ensurePartnerCommissionConfig();
}

/// Only ever affects agreements/referrals created AFTER this change —
/// every existing CommercialAgreement already snapshotted its own
/// commissionRateBps/commissionPolicy at creation time (see that model's
/// own doc comment) and is never retroactively touched.
export async function updatePartnerCommissionConfig(
  input: {
    buyCommissionRateBps?: number;
    rentCommissionRateBps?: number;
    buyCommissionPolicy?: PartnerCommissionPolicy;
    rentCommissionPolicy?: PartnerCommissionPolicy;
    holdDays?: number;
    attributionWindowDays?: number;
    minimumWithdrawalMinor?: number;
  },
  updatedById: string
) {
  await ensurePartnerCommissionConfig();
  const updated = await prisma.partnerCommissionConfig.update({
    where: { id: "default" },
    data: { ...input, updatedById },
  });
  await logAudit({
    schoolId: null,
    userId: updatedById,
    action: "partner_commission_config.updated",
    resourceType: "PartnerCommissionConfig",
    resourceId: "default",
    newValue: input,
  });
  return updated;
}

/// Called once per confirmed PlatformInvoice (from confirmSubscriptionPayment,
/// right after it's marked PAID). Idempotent — platformInvoiceId is @unique
/// on PartnerCommission, so a retried/duplicate webhook delivery can never
/// produce a second commission for the same payment; this function just
/// makes that safe to call from all such call sites without them needing to
/// know that on their own.
///
/// Returns null whenever no commission is owed: no CommercialAgreement on
/// the invoice, no Partner on that agreement, the agreement's optional
/// commissionEndDate cutoff has already passed, or (for
/// FIRST_PAYMENT_ONLY agreements) a commission already exists for this
/// agreement.
export async function createPartnerCommissionForInvoice(invoiceId: string): Promise<PartnerCommission | null> {
  const invoice = await prisma.platformInvoice.findUnique({
    where: { id: invoiceId },
    include: { commercialAgreement: true },
  });
  if (!invoice || !invoice.commercialAgreement) return null;

  const agreement = invoice.commercialAgreement;
  if (!agreement.partnerId) return null;

  if (agreement.commissionEndDate && new Date() > agreement.commissionEndDate) return null;

  if (agreement.commissionPolicy === "FIRST_PAYMENT_ONLY") {
    const alreadyEarned = await prisma.partnerCommission.findFirst({
      where: { commercialAgreementId: agreement.id },
      select: { id: true },
    });
    if (alreadyEarned) return null;
  }

  const config = await getPartnerCommissionConfig();
  const commissionAmountMinor = Math.round((invoice.amountMinor * agreement.commissionRateBps) / 10000);
  const earnedAt = new Date();
  const availableAt = new Date(earnedAt);
  availableAt.setDate(availableAt.getDate() + config.holdDays);

  try {
    const commission = await prisma.partnerCommission.create({
      data: {
        partnerId: agreement.partnerId,
        schoolId: invoice.schoolId,
        commercialAgreementId: agreement.id,
        platformInvoiceId: invoice.id,
        commercialMode: agreement.commercialMode,
        commissionRateBps: agreement.commissionRateBps,
        eligibleAmountMinor: invoice.amountMinor,
        commissionAmountMinor,
        currency: invoice.currency,
        earnedAt,
        availableAt,
      },
    });

    await logAudit({
      schoolId: invoice.schoolId,
      userId: null,
      action: "partner_commission.created",
      resourceType: "PartnerCommission",
      resourceId: commission.id,
      newValue: {
        partnerId: agreement.partnerId,
        commercialAgreementId: agreement.id,
        platformInvoiceId: invoice.id,
        commissionAmountMinor,
      },
    });

    return commission;
  } catch (error) {
    // Duplicate delivery of the same payment confirmation — the unique
    // constraint on platformInvoiceId is what actually enforces
    // idempotency; this just returns the row that already won the race
    // instead of throwing.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.partnerCommission.findUnique({ where: { platformInvoiceId: invoice.id } });
    }
    throw error;
  }
}

/// Called once per confirmed BuyerInvoice (from confirmBuyerInvoicePayment,
/// right after it's marked PAID) — the Buyer Program's own mirror of
/// createPartnerCommissionForInvoice, same idempotency/policy/cutoff rules,
/// just reading from BuyerAgreement/BuyerInvoice instead of
/// CommercialAgreement/PlatformInvoice. Writes into the exact same
/// PartnerCommission ledger (via buyerId/buyerAgreementId/buyerInvoiceId
/// instead of schoolId/commercialAgreementId/platformInvoiceId) — a
/// Partner's balance, withdrawal, hold and reversal machinery never needs
/// to know or care which side a given commission came from.
export async function createPartnerCommissionForBuyerInvoice(invoiceId: string): Promise<PartnerCommission | null> {
  const invoice = await prisma.buyerInvoice.findUnique({
    where: { id: invoiceId },
    include: { buyerAgreement: true },
  });
  if (!invoice) return null;

  const agreement = invoice.buyerAgreement;
  if (!agreement.partnerId) return null;

  if (agreement.commissionEndDate && new Date() > agreement.commissionEndDate) return null;

  if (agreement.commissionPolicy === "FIRST_PAYMENT_ONLY") {
    const alreadyEarned = await prisma.partnerCommission.findFirst({
      where: { buyerAgreementId: agreement.id },
      select: { id: true },
    });
    if (alreadyEarned) return null;
  }

  const config = await getPartnerCommissionConfig();
  const commissionAmountMinor = Math.round((invoice.amountMinor * agreement.commissionRateBps) / 10000);
  const earnedAt = new Date();
  const availableAt = new Date(earnedAt);
  availableAt.setDate(availableAt.getDate() + config.holdDays);

  try {
    const commission = await prisma.partnerCommission.create({
      data: {
        partnerId: agreement.partnerId,
        buyerId: invoice.buyerId,
        buyerAgreementId: agreement.id,
        buyerInvoiceId: invoice.id,
        commercialMode: "BUY",
        commissionRateBps: agreement.commissionRateBps,
        eligibleAmountMinor: invoice.amountMinor,
        commissionAmountMinor,
        currency: invoice.currency,
        earnedAt,
        availableAt,
      },
    });

    await logAudit({
      schoolId: null,
      userId: null,
      action: "partner_commission.created",
      resourceType: "PartnerCommission",
      resourceId: commission.id,
      newValue: {
        partnerId: agreement.partnerId,
        buyerAgreementId: agreement.id,
        buyerInvoiceId: invoice.id,
        commissionAmountMinor,
      },
    });

    return commission;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.partnerCommission.findUnique({ where: { buyerInvoiceId: invoice.id } });
    }
    throw error;
  }
}

/// The one, explicit, Super-Admin-only, reason-required way to invalidate
/// an already-created commission (e.g. the underlying payment was
/// refunded) — append-only: the original commission's own amount fields
/// are never edited, only its status flips to REVERSED alongside a
/// PartnerCommissionReversal row recording who/why/when. Refuses a
/// commission that's already REVERSED/PAID/CANCELLED, or one currently
/// allocated to a withdrawal request (that withdrawal must be resolved —
/// rejected/cancelled, releasing the allocation — before this can run).
export async function reversePartnerCommission(input: { commissionId: string; reversedById: string; reason: string }) {
  const reason = input.reason.trim();
  if (!reason) throw new Error("A reason is required to reverse a commission.");

  const commission = await prisma.partnerCommission.findUnique({
    where: { id: input.commissionId },
    include: { allocation: true },
  });
  if (!commission) throw new Error("Commission not found.");
  if (commission.status === "REVERSED") throw new Error("This commission has already been reversed.");
  if (commission.status === "PAID") throw new Error("A commission that has already been paid out cannot be reversed.");
  if (commission.status === "CANCELLED") throw new Error("This commission is already cancelled.");
  if (commission.allocation) {
    throw new Error("This commission is allocated to a withdrawal request — resolve that withdrawal first.");
  }

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const reversal = await tx.partnerCommissionReversal.create({
      data: { commissionId: commission.id, reason, reversedById: input.reversedById, reversedAt: now },
    });
    const updated = await tx.partnerCommission.update({
      where: { id: commission.id },
      data: { status: "REVERSED", reversedAt: now },
    });
    return { reversal, updated };
  });

  await logAudit({
    schoolId: commission.schoolId,
    userId: input.reversedById,
    action: "partner_commission.reversed",
    resourceType: "PartnerCommission",
    resourceId: commission.id,
    newValue: { reason },
  });

  return result.updated;
}

/// PartnerCommission.status is a stored column, not purely derived, but
/// nothing ever flips PENDING -> AVAILABLE on its own (no cron exists in
/// this codebase) — every read path that cares about a Partner's real,
/// spendable balance must reconcile lazily first, exactly like
/// entitlements.ts's reconcile() does for subscription status. Safe to
/// call as often as needed; a commission already past PENDING is left
/// untouched.
export async function reconcilePartnerCommissions(partnerId: string) {
  await prisma.partnerCommission.updateMany({
    where: { partnerId, status: "PENDING", availableAt: { lte: new Date() } },
    data: { status: "AVAILABLE" },
  });
}
