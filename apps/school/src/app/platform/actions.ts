"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/require";
import {
  updateSchoolStatus,
  changeSchoolPlan,
  createSubscriptionForSchool,
  updateSubscriptionStatus,
  generatePlatformInvoice,
  markPlatformInvoicePaid,
  voidPlatformInvoice,
  createPlan,
  updatePlan,
  updatePlanFeatures,
  setPlanActive,
} from "@/lib/services/platform";
import { toMinorUnits } from "@/lib/money";
import { logAudit } from "@/lib/audit";

export interface PlatformFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

const schoolStatusSchema = z.object({ schoolId: z.string().trim().min(1), status: z.enum(["TRIAL", "ACTIVE", "SUSPENDED"]) });

export async function updateSchoolStatusAction(_prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  const admin = await requireSuperAdmin();
  const parsed = schoolStatusSchema.safeParse({ schoolId: formData.get("schoolId"), status: formData.get("status") });
  if (!parsed.success) return { status: "error", message: "Please check your selection." };

  await updateSchoolStatus(parsed.data.schoolId, parsed.data.status);
  await logAudit({ schoolId: parsed.data.schoolId, userId: admin.id, action: "platform.school_status_changed", resourceType: "School", resourceId: parsed.data.schoolId, newValue: { status: parsed.data.status } });
  revalidatePath(`/platform/schools/${parsed.data.schoolId}`);
  revalidatePath("/platform/schools");
  revalidatePath("/platform");
  return { status: "success" };
}

const planChangeSchema = z.object({ schoolId: z.string().trim().min(1), planId: z.string().trim().min(1, "Choose a plan") });

export async function changeSchoolPlanAction(_prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  const admin = await requireSuperAdmin();
  const parsed = planChangeSchema.safeParse({ schoolId: formData.get("schoolId"), planId: formData.get("planId") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your selection." };

  try {
    await changeSchoolPlan(parsed.data.schoolId, parsed.data.planId);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not change this school's plan." };
  }
  await logAudit({ schoolId: parsed.data.schoolId, userId: admin.id, action: "platform.plan_changed", resourceType: "Subscription", resourceId: parsed.data.schoolId, newValue: { planId: parsed.data.planId } });
  revalidatePath(`/platform/schools/${parsed.data.schoolId}`);
  return { status: "success" };
}

export async function createSubscriptionAction(_prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  const admin = await requireSuperAdmin();
  const parsed = planChangeSchema.safeParse({ schoolId: formData.get("schoolId"), planId: formData.get("planId") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your selection." };

  try {
    await createSubscriptionForSchool(parsed.data.schoolId, parsed.data.planId);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not create a subscription for this school." };
  }
  await logAudit({ schoolId: parsed.data.schoolId, userId: admin.id, action: "platform.subscription_created", resourceType: "Subscription", resourceId: parsed.data.schoolId, newValue: { planId: parsed.data.planId } });
  revalidatePath(`/platform/schools/${parsed.data.schoolId}`);
  return { status: "success" };
}

const subStatusSchema = z.object({
  schoolId: z.string().trim().min(1),
  status: z.enum(["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED", "EXPIRED", "SUSPENDED"]),
});

export async function updateSubscriptionStatusAction(_prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  const admin = await requireSuperAdmin();
  const parsed = subStatusSchema.safeParse({ schoolId: formData.get("schoolId"), status: formData.get("status") });
  if (!parsed.success) return { status: "error", message: "Please check your selection." };

  try {
    await updateSubscriptionStatus(parsed.data.schoolId, parsed.data.status);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not update subscription status." };
  }
  await logAudit({ schoolId: parsed.data.schoolId, userId: admin.id, action: "platform.subscription_status_changed", resourceType: "Subscription", resourceId: parsed.data.schoolId, newValue: { status: parsed.data.status } });
  revalidatePath(`/platform/schools/${parsed.data.schoolId}`);
  return { status: "success" };
}

export async function generatePlatformInvoiceAction(schoolId: string) {
  const admin = await requireSuperAdmin();
  const invoice = await generatePlatformInvoice(schoolId);
  await logAudit({ schoolId, userId: admin.id, action: "platform.invoice_generated", resourceType: "PlatformInvoice", resourceId: invoice.id });
  revalidatePath(`/platform/schools/${schoolId}`);
}

export async function markPlatformInvoicePaidAction(invoiceId: string, schoolId: string) {
  const admin = await requireSuperAdmin();
  await markPlatformInvoicePaid(invoiceId, admin.id);
  await logAudit({ schoolId, userId: admin.id, action: "platform.invoice_marked_paid", resourceType: "PlatformInvoice", resourceId: invoiceId });
  revalidatePath(`/platform/schools/${schoolId}`);
}

export async function voidPlatformInvoiceAction(invoiceId: string, schoolId: string) {
  const admin = await requireSuperAdmin();
  await voidPlatformInvoice(invoiceId);
  await logAudit({ schoolId, userId: admin.id, action: "platform.invoice_voided", resourceType: "PlatformInvoice", resourceId: invoiceId });
  revalidatePath(`/platform/schools/${schoolId}`);
}

const planSchema = z.object({
  name: z.string().trim().min(1, "Enter a plan name"),
  tagline: z.string().trim().max(200).optional().or(z.literal("")),
  isCustomPricing: z.literal("on").optional(),
  priceMonthly: z.string().trim().optional().or(z.literal("")),
  priceAnnual: z.string().trim().optional().or(z.literal("")),
  studentLimit: z.string().trim().optional().or(z.literal("")),
  isMostPopular: z.literal("on").optional(),
});

function parsePlanForm(formData: FormData) {
  return planSchema.safeParse({
    name: formData.get("name"),
    tagline: formData.get("tagline") ?? "",
    isCustomPricing: formData.get("isCustomPricing") ?? undefined,
    priceMonthly: formData.get("priceMonthly") ?? "",
    priceAnnual: formData.get("priceAnnual") ?? "",
    studentLimit: formData.get("studentLimit") ?? "",
    isMostPopular: formData.get("isMostPopular") ?? undefined,
  });
}

function planInputFromParsed(parsed: z.infer<typeof planSchema>) {
  const isCustomPricing = parsed.isCustomPricing === "on";
  return {
    name: parsed.name,
    tagline: parsed.tagline || null,
    isCustomPricing,
    priceMonthlyMinor: !isCustomPricing && parsed.priceMonthly ? toMinorUnits(Number(parsed.priceMonthly)) : null,
    priceAnnualMinor: !isCustomPricing && parsed.priceAnnual ? toMinorUnits(Number(parsed.priceAnnual)) : null,
    studentLimit: parsed.studentLimit ? Number(parsed.studentLimit) : null,
    isMostPopular: parsed.isMostPopular === "on",
  };
}

const slugFromName = (name: string) => name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/(^_|_$)/g, "");

export async function createPlanAction(_prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  await requireSuperAdmin();
  const parsed = parsePlanForm(formData);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    await createPlan(slugFromName(parsed.data.name), planInputFromParsed(parsed.data));
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not create this plan." };
  }
  revalidatePath("/platform/plans");
  return { status: "success" };
}

export async function updatePlanAction(planId: string, _prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  await requireSuperAdmin();
  const parsed = parsePlanForm(formData);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    await updatePlan(planId, planInputFromParsed(parsed.data));
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not update this plan." };
  }
  revalidatePath("/platform/plans");
  revalidatePath("/pricing");
  return { status: "success" };
}

export async function setPlanActiveAction(planId: string, isActive: boolean) {
  await requireSuperAdmin();
  await setPlanActive(planId, isActive);
  revalidatePath("/platform/plans");
  revalidatePath("/pricing");
}

export async function togglePlanFeatureAction(planId: string, featureKey: string, enabled: boolean) {
  const admin = await requireSuperAdmin();
  await updatePlanFeatures(planId, { [featureKey]: enabled });
  await logAudit({
    schoolId: null,
    userId: admin.id,
    action: "platform.plan_feature_toggled",
    resourceType: "SubscriptionPlan",
    resourceId: planId,
    newValue: { [featureKey]: enabled },
  });
  revalidatePath("/platform/plans");
  revalidatePath("/pricing");
}
