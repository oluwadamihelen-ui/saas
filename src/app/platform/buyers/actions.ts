"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin, withAuthErrors } from "@/lib/auth/require";
import { suspendBuyer, reactivateBuyer, resetBuyerPassword } from "@/lib/services/buyer-onboarding";
import {
  createBuyerAgreement,
  approveAndActivateBuyerAgreement,
  cancelBuyerAgreement,
  markBuyerAgreementCompleted,
  postBuyerProgressUpdate,
} from "@/lib/services/buyer-agreements";
import { createBuyerInvoice, markBuyerInvoicePaid, voidBuyerInvoice } from "@/lib/services/buyer-invoices";
import { manuallyAttributeBuyerReferral, overrideBuyerReferral } from "@/lib/services/partner-referrals";
import { toMinorUnits } from "@/lib/money";

export interface PlatformFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

const reasonSchema = z.object({ buyerId: z.string().trim().min(1), reason: z.string().trim().min(1, "A reason is required") });

export const suspendBuyerAction = withAuthErrors(async function suspendBuyerAction(_prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  const admin = await requireSuperAdmin();
  const parsed = reasonSchema.safeParse({ buyerId: formData.get("buyerId"), reason: formData.get("reason") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    await suspendBuyer(parsed.data.buyerId, admin.id, parsed.data.reason);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not suspend this Buyer." };
  }
  revalidatePath(`/platform/buyers/${parsed.data.buyerId}`);
  revalidatePath("/platform/buyers");
  return { status: "success" };
});

export interface ResetPasswordState {
  status: "idle" | "error" | "success";
  message?: string;
  credentials?: { email: string; temporaryPassword: string };
}

export const resetBuyerPasswordAction = withAuthErrors(async function resetBuyerPasswordAction(buyerId: string, _prev: ResetPasswordState, _formData: FormData): Promise<ResetPasswordState> {
  const admin = await requireSuperAdmin();
  try {
    const { email, temporaryPassword } = await resetBuyerPassword(buyerId, admin.id);
    return { status: "success", credentials: { email, temporaryPassword } };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not reset this Buyer's password." };
  }
});

export async function reactivateBuyerAction(buyerId: string) {
  const admin = await requireSuperAdmin();
  await reactivateBuyer(buyerId, admin.id);
  revalidatePath(`/platform/buyers/${buyerId}`);
  revalidatePath("/platform/buyers");
}

const attributeSchema = z.object({
  buyerId: z.string().trim().min(1),
  partnerId: z.string().trim().min(1, "Choose a Partner"),
});

/// Sets the very first attribution for a Buyer that currently has none —
/// the Buyer Program's own mirror of attributePartnerReferralAction.
export const attributeBuyerReferralAction = withAuthErrors(async function attributeBuyerReferralAction(_prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  const admin = await requireSuperAdmin();
  const parsed = attributeSchema.safeParse({ buyerId: formData.get("buyerId"), partnerId: formData.get("partnerId") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    await manuallyAttributeBuyerReferral({ buyerId: parsed.data.buyerId, partnerId: parsed.data.partnerId, attributedById: admin.id });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not attribute this Buyer to a Partner." };
  }
  revalidatePath(`/platform/buyers/${parsed.data.buyerId}`);
  revalidatePath("/platform/partners");
  return { status: "success" };
});

const overrideSchema = z.object({
  buyerId: z.string().trim().min(1),
  partnerId: z.string().trim().min(1, "Choose a Partner"),
  reason: z.string().trim().min(1, "A reason is required"),
});

export const overrideBuyerReferralAction = withAuthErrors(async function overrideBuyerReferralAction(_prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  const admin = await requireSuperAdmin();
  const parsed = overrideSchema.safeParse({
    buyerId: formData.get("buyerId"),
    partnerId: formData.get("partnerId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    await overrideBuyerReferral({
      buyerId: parsed.data.buyerId,
      newPartnerId: parsed.data.partnerId,
      overriddenById: admin.id,
      reason: parsed.data.reason,
    });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not override this Buyer's Partner attribution." };
  }
  revalidatePath(`/platform/buyers/${parsed.data.buyerId}`);
  revalidatePath("/platform/partners");
  return { status: "success" };
});

const createAgreementSchema = z.object({
  buyerId: z.string().trim().min(1),
  partnerId: z.string().trim().min(1).optional().or(z.literal("")),
  agreementValue: z.string().trim().optional().or(z.literal("")),
  paymentArrangement: z.enum(["ONE_TIME", "INSTALLMENT"]).optional().or(z.literal("")),
});

export const createBuyerAgreementAction = withAuthErrors(async function createBuyerAgreementAction(_prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  const admin = await requireSuperAdmin();
  const parsed = createAgreementSchema.safeParse({
    buyerId: formData.get("buyerId"),
    partnerId: formData.get("partnerId") ?? "",
    agreementValue: formData.get("agreementValue") ?? "",
    paymentArrangement: formData.get("paymentArrangement") ?? "",
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    await createBuyerAgreement({
      buyerId: parsed.data.buyerId,
      partnerId: parsed.data.partnerId || null,
      agreementValueMinor: parsed.data.agreementValue ? toMinorUnits(Number(parsed.data.agreementValue)) : null,
      paymentArrangement: parsed.data.paymentArrangement || null,
      createdById: admin.id,
    });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not create this agreement." };
  }
  revalidatePath(`/platform/buyers/${parsed.data.buyerId}`);
  return { status: "success" };
});

export async function approveBuyerAgreementAction(agreementId: string, buyerId: string) {
  const admin = await requireSuperAdmin();
  await approveAndActivateBuyerAgreement({ agreementId, approvedById: admin.id });
  revalidatePath(`/platform/buyers/${buyerId}`);
}

const agreementReasonSchema = z.object({
  agreementId: z.string().trim().min(1),
  buyerId: z.string().trim().min(1),
  reason: z.string().trim().min(1, "A reason is required"),
});

export const cancelBuyerAgreementAction = withAuthErrors(async function cancelBuyerAgreementAction(_prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  const admin = await requireSuperAdmin();
  const parsed = agreementReasonSchema.safeParse({
    agreementId: formData.get("agreementId"),
    buyerId: formData.get("buyerId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    await cancelBuyerAgreement({ agreementId: parsed.data.agreementId, cancelledById: admin.id, reason: parsed.data.reason });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not cancel this agreement." };
  }
  revalidatePath(`/platform/buyers/${parsed.data.buyerId}`);
  return { status: "success" };
});

export async function markBuyerAgreementCompletedAction(agreementId: string, buyerId: string) {
  const admin = await requireSuperAdmin();
  await markBuyerAgreementCompleted({ agreementId, completedById: admin.id });
  revalidatePath(`/platform/buyers/${buyerId}`);
}

const progressSchema = z.object({
  agreementId: z.string().trim().min(1),
  buyerId: z.string().trim().min(1),
  stage: z.enum(["ORDER_CONFIRMED", "IN_DEVELOPMENT", "INSTALLATION", "DELIVERED"]),
  note: z.string().trim().optional().or(z.literal("")),
});

export const postBuyerProgressUpdateAction = withAuthErrors(async function postBuyerProgressUpdateAction(_prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  const admin = await requireSuperAdmin();
  const parsed = progressSchema.safeParse({
    agreementId: formData.get("agreementId"),
    buyerId: formData.get("buyerId"),
    stage: formData.get("stage"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    await postBuyerProgressUpdate({
      agreementId: parsed.data.agreementId,
      stage: parsed.data.stage,
      note: parsed.data.note || null,
      postedById: admin.id,
    });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not post this progress update." };
  }
  revalidatePath(`/platform/buyers/${parsed.data.buyerId}`);
  return { status: "success" };
});

const createInvoiceSchema = z.object({
  agreementId: z.string().trim().min(1),
  buyerId: z.string().trim().min(1),
  description: z.string().trim().optional().or(z.literal("")),
  amount: z.string().trim().min(1, "An amount is required"),
  dueDate: z.string().trim().min(1, "A due date is required"),
});

export const createBuyerInvoiceAction = withAuthErrors(async function createBuyerInvoiceAction(_prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  const admin = await requireSuperAdmin();
  const parsed = createInvoiceSchema.safeParse({
    agreementId: formData.get("agreementId"),
    buyerId: formData.get("buyerId"),
    description: formData.get("description") ?? "",
    amount: formData.get("amount"),
    dueDate: formData.get("dueDate"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    await createBuyerInvoice({
      agreementId: parsed.data.agreementId,
      description: parsed.data.description || null,
      amountMinor: toMinorUnits(Number(parsed.data.amount)),
      dueDate: new Date(parsed.data.dueDate),
      createdById: admin.id,
    });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not create this invoice." };
  }
  revalidatePath(`/platform/buyers/${parsed.data.buyerId}`);
  return { status: "success" };
});

export async function markBuyerInvoicePaidAction(invoiceId: string, buyerId: string) {
  const admin = await requireSuperAdmin();
  await markBuyerInvoicePaid(invoiceId, admin.id);
  revalidatePath(`/platform/buyers/${buyerId}`);
}

export async function voidBuyerInvoiceAction(invoiceId: string, buyerId: string) {
  const admin = await requireSuperAdmin();
  await voidBuyerInvoice(invoiceId, admin.id);
  revalidatePath(`/platform/buyers/${buyerId}`);
}
