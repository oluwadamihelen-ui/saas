import "server-only";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getPartnerCommissionConfig } from "@/lib/services/partner-commissions";
import { notifyCommercialAgreementActivated, notifyRentSubscriptionStopped } from "@/lib/services/notifications";
import type { CommercialMode, PaymentArrangement } from "@/generated/prisma/client";

/// Creates a new commercial deal in PENDING — never operative on its own
/// (see canCreateInvoice below). A BUY agreement never carries a
/// subscriptionId (a purchase isn't a subscription period); a RENT one
/// created here explicitly (as opposed to the auto-create hook below) must
/// name the school's existing Subscription.
export async function createCommercialAgreement(input: {
  schoolId: string;
  partnerId?: string | null;
  commercialMode: CommercialMode;
  subscriptionId?: string | null;
  agreementValueMinor?: number | null;
  currency?: string;
  paymentArrangement?: PaymentArrangement | null;
  commissionEndDate?: Date | null;
  createdById: string;
}) {
  if (input.commercialMode === "BUY" && input.subscriptionId) {
    throw new Error("A BUY agreement cannot be tied to a Subscription.");
  }
  if (input.commercialMode === "RENT") {
    if (!input.subscriptionId) throw new Error("A RENT agreement must reference the school's Subscription.");
    const subscription = await prisma.subscription.findUnique({ where: { id: input.subscriptionId } });
    if (!subscription || subscription.schoolId !== input.schoolId) {
      throw new Error("That Subscription does not belong to this school.");
    }
  }

  const config = await getPartnerCommissionConfig();
  const commissionRateBps = input.commercialMode === "BUY" ? config.buyCommissionRateBps : config.rentCommissionRateBps;
  const commissionPolicy = input.commercialMode === "BUY" ? config.buyCommissionPolicy : config.rentCommissionPolicy;

  const agreement = await prisma.commercialAgreement.create({
    data: {
      schoolId: input.schoolId,
      partnerId: input.partnerId ?? null,
      commercialMode: input.commercialMode,
      subscriptionId: input.subscriptionId ?? null,
      agreementValueMinor: input.agreementValueMinor ?? null,
      currency: input.currency ?? "NGN",
      paymentArrangement: input.paymentArrangement ?? null,
      commissionRateBps,
      commissionPolicy,
      commissionEndDate: input.commissionEndDate ?? null,
      createdById: input.createdById,
    },
  });

  await logAudit({
    schoolId: input.schoolId,
    userId: input.createdById,
    action: "commercial_agreement.created",
    resourceType: "CommercialAgreement",
    resourceId: agreement.id,
    newValue: { commercialMode: input.commercialMode, partnerId: input.partnerId ?? null },
  });

  return agreement;
}

/// FINAL (Round 7) rule: only an ACTIVE agreement may create invoices —
/// there is no PENDING+approvedAt alternative pathway.
export function canCreateInvoice(agreement: { status: string }): boolean {
  return agreement.status === "ACTIVE";
}

/// Approving a PENDING agreement activates it atomically, in the same
/// transaction — there is no normal state where status=PENDING and
/// approvedAt is already set. When this is a BUY agreement superseding an
/// already-ACTIVE RENT one for the same school, the RENT->BUY transition
/// (RENT ACTIVE->SUPERSEDED, and optionally its Subscription CANCELED) runs
/// in that same transaction too. Notifications fire only after the
/// transaction commits.
export async function approveAndActivateCommercialAgreement(input: {
  agreementId: string;
  approvedById: string;
  /// Only consulted when this approval supersedes an ACTIVE RENT
  /// agreement. Defaults to true — purchasing Schoolum outright normally
  /// ends the rental relationship — but stays an explicit, audited choice
  /// rather than an assumption.
  stopRentSubscription?: boolean;
}) {
  const agreement = await prisma.commercialAgreement.findUnique({ where: { id: input.agreementId } });
  if (!agreement) throw new Error("Commercial agreement not found.");
  if (agreement.status !== "PENDING") throw new Error("Only a PENDING agreement can be approved.");

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    let supersededRentId: string | null = null;
    let stoppedSubscriptionId: string | null = null;

    if (agreement.commercialMode === "BUY") {
      const activeRent = await tx.commercialAgreement.findFirst({
        where: { schoolId: agreement.schoolId, status: "ACTIVE", commercialMode: "RENT" },
      });
      if (activeRent) {
        await tx.commercialAgreement.update({
          where: { id: activeRent.id },
          data: { status: "SUPERSEDED", endedAt: now },
        });
        supersededRentId = activeRent.id;

        const shouldStop = input.stopRentSubscription ?? true;
        if (shouldStop && activeRent.subscriptionId) {
          await tx.subscription.update({
            where: { id: activeRent.subscriptionId },
            data: { status: "CANCELED", canceledAt: now },
          });
          stoppedSubscriptionId = activeRent.subscriptionId;
        }
      }
    }

    const activated = await tx.commercialAgreement.update({
      where: { id: agreement.id },
      data: {
        status: "ACTIVE",
        approvedAt: now,
        approvedById: input.approvedById,
        startedAt: now,
        activatedById: input.approvedById,
      },
    });

    return { activated, supersededRentId, stoppedSubscriptionId };
  });

  await logAudit({
    schoolId: agreement.schoolId,
    userId: input.approvedById,
    action: "commercial_agreement.approved_and_activated",
    resourceType: "CommercialAgreement",
    resourceId: agreement.id,
    newValue: { commercialMode: agreement.commercialMode },
  });
  if (result.supersededRentId) {
    await logAudit({
      schoolId: agreement.schoolId,
      userId: input.approvedById,
      action: "commercial_agreement.superseded",
      resourceType: "CommercialAgreement",
      resourceId: result.supersededRentId,
      newValue: { supersededBy: agreement.id },
    });
  }
  if (result.stoppedSubscriptionId) {
    await logAudit({
      schoolId: agreement.schoolId,
      userId: input.approvedById,
      action: "subscription.stopped_for_buy_agreement",
      resourceType: "Subscription",
      resourceId: result.stoppedSubscriptionId,
      newValue: { stopRentSubscription: true, commercialAgreementId: agreement.id },
    });
  }

  await notifyCommercialAgreementActivated(agreement.schoolId, agreement.commercialMode);
  if (result.stoppedSubscriptionId) {
    await notifyRentSubscriptionStopped(agreement.schoolId);
  }

  return result.activated;
}

/// Negotiation abandoned or deal terminated. Never touches any invoice,
/// payment, or commission already created while this agreement was
/// ACTIVE — financial history is sacred (see the model's own doc comment).
export async function cancelCommercialAgreement(input: { agreementId: string; cancelledById: string; reason: string }) {
  const reason = input.reason.trim();
  if (!reason) throw new Error("A reason is required to cancel a commercial agreement.");

  const agreement = await prisma.commercialAgreement.findUnique({ where: { id: input.agreementId } });
  if (!agreement) throw new Error("Commercial agreement not found.");
  if (agreement.status === "COMPLETED" || agreement.status === "CANCELLED" || agreement.status === "SUPERSEDED") {
    throw new Error("This agreement is already closed.");
  }

  const now = new Date();
  const updated = await prisma.commercialAgreement.update({
    where: { id: input.agreementId },
    data: { status: "CANCELLED", cancelledAt: now, cancelledById: input.cancelledById, cancellationReason: reason, endedAt: now },
  });

  await logAudit({
    schoolId: agreement.schoolId,
    userId: input.cancelledById,
    action: "commercial_agreement.cancelled",
    resourceType: "CommercialAgreement",
    resourceId: agreement.id,
    newValue: { reason },
  });

  return updated;
}

/// Explicit Super Admin action for a BUY agreement whose agreed purchase
/// obligations are all fulfilled — never inferred automatically from
/// summing installment amounts (see the model's own doc comment).
export async function markCommercialAgreementCompleted(input: { agreementId: string; completedById: string }) {
  const agreement = await prisma.commercialAgreement.findUnique({ where: { id: input.agreementId } });
  if (!agreement) throw new Error("Commercial agreement not found.");
  if (agreement.status !== "ACTIVE") throw new Error("Only an ACTIVE agreement can be marked completed.");

  const now = new Date();
  const updated = await prisma.commercialAgreement.update({
    where: { id: input.agreementId },
    data: { status: "COMPLETED", completedAt: now, completedById: input.completedById, endedAt: now },
  });

  await logAudit({
    schoolId: agreement.schoolId,
    userId: input.completedById,
    action: "commercial_agreement.completed",
    resourceType: "CommercialAgreement",
    resourceId: agreement.id,
  });

  return updated;
}

/// A BUY installment invoice — the one other PlatformInvoice creation path
/// besides RENT's subscription-period invoices. Gated by canCreateInvoice:
/// an agreement that isn't ACTIVE can never produce one, full stop.
export async function createBuyInstallmentInvoice(input: {
  agreementId: string;
  amountMinor: number;
  dueDate: Date;
  createdById: string;
}) {
  const agreement = await prisma.commercialAgreement.findUnique({ where: { id: input.agreementId } });
  if (!agreement) throw new Error("Commercial agreement not found.");
  if (agreement.commercialMode !== "BUY") throw new Error("Only a BUY agreement can have installment invoices.");
  if (!canCreateInvoice(agreement)) throw new Error("This agreement is not ACTIVE — it cannot create invoices.");

  const invoice = await prisma.platformInvoice.create({
    data: {
      schoolId: agreement.schoolId,
      commercialAgreementId: agreement.id,
      // A BUY installment isn't a subscription period at all — periodStart/
      // periodEnd exist only because the column is required; both are set
      // to the due date, the one date that's actually meaningful here.
      periodStart: input.dueDate,
      periodEnd: input.dueDate,
      amountMinor: input.amountMinor,
      currency: agreement.currency,
      dueDate: input.dueDate,
    },
  });

  await logAudit({
    schoolId: agreement.schoolId,
    userId: input.createdById,
    action: "platform_invoice.buy_installment_created",
    resourceType: "PlatformInvoice",
    resourceId: invoice.id,
    newValue: { commercialAgreementId: agreement.id, amountMinor: input.amountMinor },
  });

  return invoice;
}

/// The auto-create-RENT-agreement hook: called from generatePlatformInvoice
/// and changePlanSelfServe right before they create a real (non-trial)
/// subscription-period PlatformInvoice, so it can be linked via
/// commercialAgreementId. Returns null for the overwhelming majority of
/// schools (no Partner involved at all) with zero writes. A school that
/// already has an ACTIVE RENT agreement just gets that id back — this only
/// ever creates one the first time it's needed.
///
/// Deliberately auto-activates (never PENDING): unlike a BUY deal, there is
/// no human negotiation step in this app's existing self-serve subscription
/// flow at all — a school converting from trial to paid, or renewing, does
/// so with no Super Admin gate today, and gating it here for a referred
/// school alone would be a functional regression this program was never
/// asked to introduce. Trials never reach this path — it only runs where a
/// real, billable subscription period invoice is about to be created.
export async function getOrCreateRentAgreementForInvoice(schoolId: string, subscriptionId: string): Promise<string | null> {
  const activeAgreement = await prisma.commercialAgreement.findFirst({
    where: { schoolId, status: "ACTIVE" },
  });
  if (activeAgreement) {
    return activeAgreement.commercialMode === "RENT" ? activeAgreement.id : null;
  }

  const referral = await prisma.partnerReferral.findUnique({ where: { schoolId } });
  if (!referral || referral.status !== "ACTIVE") return null;

  const subscription = await prisma.subscription.findUnique({ where: { id: subscriptionId }, include: { plan: true } });
  if (!subscription || subscription.schoolId !== schoolId) return null;

  const config = await getPartnerCommissionConfig();
  const now = new Date();
  const agreement = await prisma.commercialAgreement.create({
    data: {
      schoolId,
      partnerId: referral.partnerId,
      commercialMode: "RENT",
      status: "ACTIVE",
      subscriptionId,
      currency: subscription.plan.currency,
      commissionRateBps: config.rentCommissionRateBps,
      commissionPolicy: config.rentCommissionPolicy,
      startedAt: now,
    },
  });

  await logAudit({
    schoolId,
    userId: null,
    action: "commercial_agreement.auto_created_rent",
    resourceType: "CommercialAgreement",
    resourceId: agreement.id,
    newValue: { partnerId: referral.partnerId, subscriptionId },
  });

  return agreement.id;
}
