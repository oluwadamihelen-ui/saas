"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { changePlanSelfServe, cancelSubscriptionSelfServe, reactivateSubscriptionSelfServe, DowngradeBlockedError } from "@/lib/services/billing";
import { initializeSubscriptionPayment } from "@/lib/billing/payment-provider";
import { logAudit } from "@/lib/audit";

async function currentOrigin() {
  if (process.env.APP_URL) return process.env.APP_URL;
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export interface BillingFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

const changePlanSchema = z.object({
  planId: z.string().trim().min(1, "Choose a plan"),
  billingInterval: z.enum(["MONTHLY", "YEARLY"]),
});

export async function changePlanAction(_prev: BillingFormState, formData: FormData): Promise<BillingFormState> {
  const user = await requirePermission(PERMISSIONS.BILLING_MANAGE);
  const parsed = changePlanSchema.safeParse({
    planId: formData.get("planId"),
    billingInterval: formData.get("billingInterval"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your selection." };

  try {
    await changePlanSelfServe(user.schoolId, parsed.data.planId, parsed.data.billingInterval);
  } catch (error) {
    if (error instanceof DowngradeBlockedError) return { status: "error", message: error.message };
    return { status: "error", message: error instanceof Error ? error.message : "Could not change your plan." };
  }
  await logAudit({
    schoolId: user.schoolId,
    userId: user.id,
    action: "billing.plan_changed",
    resourceType: "Subscription",
    resourceId: user.schoolId,
    newValue: { planId: parsed.data.planId, billingInterval: parsed.data.billingInterval },
  });
  revalidatePath("/dashboard/billing");
  return { status: "success" };
}

export async function cancelSubscriptionAction(_prev: BillingFormState, _formData: FormData): Promise<BillingFormState> {
  const user = await requirePermission(PERMISSIONS.BILLING_MANAGE);
  try {
    await cancelSubscriptionSelfServe(user.schoolId);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not cancel your subscription." };
  }
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "billing.subscription_cancelled", resourceType: "Subscription", resourceId: user.schoolId });
  revalidatePath("/dashboard/billing");
  return { status: "success" };
}

const reactivateSchema = z.object({ billingInterval: z.enum(["MONTHLY", "YEARLY"]) });

export async function reactivateSubscriptionAction(_prev: BillingFormState, formData: FormData): Promise<BillingFormState> {
  const user = await requirePermission(PERMISSIONS.BILLING_MANAGE);
  const parsed = reactivateSchema.safeParse({ billingInterval: formData.get("billingInterval") });
  if (!parsed.success) return { status: "error", message: "Please check your selection." };

  try {
    await reactivateSubscriptionSelfServe(user.schoolId, parsed.data.billingInterval);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not renew your subscription." };
  }
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "billing.subscription_reactivated", resourceType: "Subscription", resourceId: user.schoolId });
  revalidatePath("/dashboard/billing");
  return { status: "success" };
}

export async function payInvoiceAction(invoiceId: string, _prev: BillingFormState, _formData: FormData): Promise<BillingFormState> {
  const user = await requirePermission(PERMISSIONS.BILLING_MANAGE);
  let authorizationUrl: string;
  try {
    const origin = await currentOrigin();
    const result = await initializeSubscriptionPayment(user.schoolId, invoiceId, user.email!, `${origin}/dashboard/billing/confirm`);
    authorizationUrl = result.authorizationUrl;
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not start payment." };
  }
  redirect(authorizationUrl);
}
