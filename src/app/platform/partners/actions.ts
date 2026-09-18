"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin, withAuthErrors } from "@/lib/auth/require";
import { manuallyAttributePartnerReferral, overridePartnerReferral } from "@/lib/services/partner-referrals";
import { approvePartnerApplication, rejectPartnerApplication, suspendPartner, reactivatePartner } from "@/lib/services/partner-onboarding";
import {
  createCommercialAgreement,
  approveAndActivateCommercialAgreement,
  cancelCommercialAgreement,
  markCommercialAgreementCompleted,
} from "@/lib/services/partner-agreements";
import { updatePartnerCommissionConfig } from "@/lib/services/partner-commissions";
import {
  markWithdrawalUnderReview,
  approveWithdrawal,
  rejectWithdrawal,
  markWithdrawalPaid,
} from "@/lib/services/partner-withdrawals";
import { toMinorUnits } from "@/lib/money";

export interface PlatformFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

const attributeSchema = z.object({
  schoolId: z.string().trim().min(1),
  partnerId: z.string().trim().min(1, "Choose a Partner"),
});

/// Sets the very first attribution for a school that currently has none.
export const attributePartnerReferralAction = withAuthErrors(async function attributePartnerReferralAction(_prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  const admin = await requireSuperAdmin();
  const parsed = attributeSchema.safeParse({ schoolId: formData.get("schoolId"), partnerId: formData.get("partnerId") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    await manuallyAttributePartnerReferral({ schoolId: parsed.data.schoolId, partnerId: parsed.data.partnerId, attributedById: admin.id });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not attribute this school to a Partner." };
  }
  revalidatePath(`/platform/schools/${parsed.data.schoolId}`);
  revalidatePath("/platform/partners");
  return { status: "success" };
});

const overrideSchema = z.object({
  schoolId: z.string().trim().min(1),
  partnerId: z.string().trim().min(1, "Choose a Partner"),
  reason: z.string().trim().min(1, "A reason is required"),
});

/// Corrects an existing attribution — the more consequential action, since
/// it reassigns real, already-flowing commission eligibility.
export const overridePartnerReferralAction = withAuthErrors(async function overridePartnerReferralAction(_prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  const admin = await requireSuperAdmin();
  const parsed = overrideSchema.safeParse({
    schoolId: formData.get("schoolId"),
    partnerId: formData.get("partnerId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    await overridePartnerReferral({
      schoolId: parsed.data.schoolId,
      newPartnerId: parsed.data.partnerId,
      overriddenById: admin.id,
      reason: parsed.data.reason,
    });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not override this school's Partner attribution." };
  }
  revalidatePath(`/platform/schools/${parsed.data.schoolId}`);
  revalidatePath("/platform/partners");
  return { status: "success" };
});

const idSchema = z.object({ partnerId: z.string().trim().min(1) });
const reasonSchema = z.object({ partnerId: z.string().trim().min(1), reason: z.string().trim().min(1, "A reason is required") });

export const approvePartnerApplicationAction = withAuthErrors(async function approvePartnerApplicationAction(_prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  const admin = await requireSuperAdmin();
  const parsed = idSchema.safeParse({ partnerId: formData.get("partnerId") });
  if (!parsed.success) return { status: "error", message: "Please check your selection." };

  try {
    await approvePartnerApplication(parsed.data.partnerId, admin.id);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not approve this application." };
  }
  revalidatePath(`/platform/partners/${parsed.data.partnerId}`);
  revalidatePath("/platform/partners");
  return { status: "success" };
});

export const rejectPartnerApplicationAction = withAuthErrors(async function rejectPartnerApplicationAction(_prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  const admin = await requireSuperAdmin();
  const parsed = reasonSchema.safeParse({ partnerId: formData.get("partnerId"), reason: formData.get("reason") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    await rejectPartnerApplication(parsed.data.partnerId, admin.id, parsed.data.reason);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not reject this application." };
  }
  revalidatePath(`/platform/partners/${parsed.data.partnerId}`);
  revalidatePath("/platform/partners");
  return { status: "success" };
});

export const suspendPartnerAction = withAuthErrors(async function suspendPartnerAction(_prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  const admin = await requireSuperAdmin();
  const parsed = reasonSchema.safeParse({ partnerId: formData.get("partnerId"), reason: formData.get("reason") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    await suspendPartner(parsed.data.partnerId, admin.id, parsed.data.reason);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not suspend this Partner." };
  }
  revalidatePath(`/platform/partners/${parsed.data.partnerId}`);
  revalidatePath("/platform/partners");
  return { status: "success" };
});

export const reactivatePartnerAction = withAuthErrors(async function reactivatePartnerAction(_prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  const admin = await requireSuperAdmin();
  const parsed = idSchema.safeParse({ partnerId: formData.get("partnerId") });
  if (!parsed.success) return { status: "error", message: "Please check your selection." };

  try {
    await reactivatePartner(parsed.data.partnerId, admin.id);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not reactivate this Partner." };
  }
  revalidatePath(`/platform/partners/${parsed.data.partnerId}`);
  revalidatePath("/platform/partners");
  return { status: "success" };
});

const createAgreementSchema = z.object({
  schoolId: z.string().trim().min(1),
  partnerId: z.string().trim().min(1).optional().or(z.literal("")),
  commercialMode: z.enum(["BUY", "RENT"]),
  subscriptionId: z.string().trim().min(1).optional().or(z.literal("")),
  agreementValue: z.string().trim().optional().or(z.literal("")),
  paymentArrangement: z.enum(["ONE_TIME", "INSTALLMENT"]).optional().or(z.literal("")),
});

export const createCommercialAgreementAction = withAuthErrors(async function createCommercialAgreementAction(_prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  const admin = await requireSuperAdmin();
  const parsed = createAgreementSchema.safeParse({
    schoolId: formData.get("schoolId"),
    partnerId: formData.get("partnerId") ?? "",
    commercialMode: formData.get("commercialMode"),
    subscriptionId: formData.get("subscriptionId") ?? "",
    agreementValue: formData.get("agreementValue") ?? "",
    paymentArrangement: formData.get("paymentArrangement") ?? "",
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    await createCommercialAgreement({
      schoolId: parsed.data.schoolId,
      partnerId: parsed.data.partnerId || null,
      commercialMode: parsed.data.commercialMode,
      subscriptionId: parsed.data.subscriptionId || null,
      agreementValueMinor: parsed.data.agreementValue ? toMinorUnits(Number(parsed.data.agreementValue)) : null,
      paymentArrangement: parsed.data.paymentArrangement || null,
      createdById: admin.id,
    });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not create this commercial agreement." };
  }
  revalidatePath(`/platform/schools/${parsed.data.schoolId}`);
  return { status: "success" };
});

const approveAgreementSchema = z.object({
  agreementId: z.string().trim().min(1),
  schoolId: z.string().trim().min(1),
  stopRentSubscription: z.literal("on").optional(),
});

export const approveCommercialAgreementAction = withAuthErrors(async function approveCommercialAgreementAction(_prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  const admin = await requireSuperAdmin();
  const parsed = approveAgreementSchema.safeParse({
    agreementId: formData.get("agreementId"),
    schoolId: formData.get("schoolId"),
    stopRentSubscription: formData.get("stopRentSubscription") ?? undefined,
  });
  if (!parsed.success) return { status: "error", message: "Please check your selection." };

  try {
    await approveAndActivateCommercialAgreement({
      agreementId: parsed.data.agreementId,
      approvedById: admin.id,
      stopRentSubscription: parsed.data.stopRentSubscription === "on",
    });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not approve this agreement." };
  }
  revalidatePath(`/platform/schools/${parsed.data.schoolId}`);
  return { status: "success" };
});

const agreementReasonSchema = z.object({
  agreementId: z.string().trim().min(1),
  schoolId: z.string().trim().min(1),
  reason: z.string().trim().min(1, "A reason is required"),
});

export const cancelCommercialAgreementAction = withAuthErrors(async function cancelCommercialAgreementAction(_prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  const admin = await requireSuperAdmin();
  const parsed = agreementReasonSchema.safeParse({
    agreementId: formData.get("agreementId"),
    schoolId: formData.get("schoolId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    await cancelCommercialAgreement({ agreementId: parsed.data.agreementId, cancelledById: admin.id, reason: parsed.data.reason });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not cancel this agreement." };
  }
  revalidatePath(`/platform/schools/${parsed.data.schoolId}`);
  return { status: "success" };
});

export async function markCommercialAgreementCompletedAction(agreementId: string, schoolId: string) {
  const admin = await requireSuperAdmin();
  await markCommercialAgreementCompleted({ agreementId, completedById: admin.id });
  revalidatePath(`/platform/schools/${schoolId}`);
}

const withdrawalReasonSchema = z.object({ withdrawalId: z.string().trim().min(1), reason: z.string().trim().min(1, "A reason is required") });
const withdrawalPaidSchema = z.object({
  withdrawalId: z.string().trim().min(1),
  payoutReference: z.string().trim().min(1, "A payout reference is required"),
  notes: z.string().trim().optional().or(z.literal("")),
});

export async function markWithdrawalUnderReviewAction(withdrawalId: string) {
  const admin = await requireSuperAdmin();
  await markWithdrawalUnderReview(withdrawalId, admin.id);
  revalidatePath("/platform/partners/withdrawals");
}

export async function approveWithdrawalAction(withdrawalId: string) {
  const admin = await requireSuperAdmin();
  await approveWithdrawal(withdrawalId, admin.id);
  revalidatePath("/platform/partners/withdrawals");
}

export const rejectWithdrawalAction = withAuthErrors(async function rejectWithdrawalAction(_prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  const admin = await requireSuperAdmin();
  const parsed = withdrawalReasonSchema.safeParse({ withdrawalId: formData.get("withdrawalId"), reason: formData.get("reason") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    await rejectWithdrawal(parsed.data.withdrawalId, admin.id, parsed.data.reason);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not reject this withdrawal." };
  }
  revalidatePath("/platform/partners/withdrawals");
  return { status: "success" };
});

export const markWithdrawalPaidAction = withAuthErrors(async function markWithdrawalPaidAction(_prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  const admin = await requireSuperAdmin();
  const parsed = withdrawalPaidSchema.safeParse({
    withdrawalId: formData.get("withdrawalId"),
    payoutReference: formData.get("payoutReference"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    await markWithdrawalPaid(parsed.data.withdrawalId, admin.id, parsed.data.payoutReference, parsed.data.notes || undefined);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not mark this withdrawal paid." };
  }
  revalidatePath("/platform/partners/withdrawals");
  return { status: "success" };
});

const configSchema = z.object({
  buyCommissionRatePercent: z.string().trim().min(1),
  rentCommissionRatePercent: z.string().trim().min(1),
  buyCommissionPolicy: z.enum(["RECURRING", "FIRST_PAYMENT_ONLY"]),
  rentCommissionPolicy: z.enum(["RECURRING", "FIRST_PAYMENT_ONLY"]),
  holdDays: z.string().trim().min(1),
  attributionWindowDays: z.string().trim().min(1),
  minimumWithdrawal: z.string().trim().min(1),
});

export const updatePartnerCommissionConfigAction = withAuthErrors(async function updatePartnerCommissionConfigAction(_prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  const admin = await requireSuperAdmin();
  const parsed = configSchema.safeParse({
    buyCommissionRatePercent: formData.get("buyCommissionRatePercent"),
    rentCommissionRatePercent: formData.get("rentCommissionRatePercent"),
    buyCommissionPolicy: formData.get("buyCommissionPolicy"),
    rentCommissionPolicy: formData.get("rentCommissionPolicy"),
    holdDays: formData.get("holdDays"),
    attributionWindowDays: formData.get("attributionWindowDays"),
    minimumWithdrawal: formData.get("minimumWithdrawal"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    await updatePartnerCommissionConfig(
      {
        buyCommissionRateBps: Math.round(Number(parsed.data.buyCommissionRatePercent) * 100),
        rentCommissionRateBps: Math.round(Number(parsed.data.rentCommissionRatePercent) * 100),
        buyCommissionPolicy: parsed.data.buyCommissionPolicy,
        rentCommissionPolicy: parsed.data.rentCommissionPolicy,
        holdDays: Number(parsed.data.holdDays),
        attributionWindowDays: Number(parsed.data.attributionWindowDays),
        minimumWithdrawalMinor: toMinorUnits(Number(parsed.data.minimumWithdrawal)),
      },
      admin.id
    );
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not save these settings." };
  }
  revalidatePath("/platform/partners/settings");
  return { status: "success" };
});
