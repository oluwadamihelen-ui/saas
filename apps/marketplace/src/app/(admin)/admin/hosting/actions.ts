"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { changeHostingPlan, suspendHostingAccount, unsuspendHostingAccount, terminateHostingAccount } from "@/lib/services/hosting-accounts";

export interface HostingActionState {
  status: "idle" | "error";
  message?: string;
}

export async function changePlanAdmin(accountId: string, _prev: HostingActionState, formData: FormData): Promise<HostingActionState> {
  const admin = await requirePermission(PERMISSIONS.HOSTING_MANAGE);
  const newPlanId = String(formData.get("newPlanId") || "");
  if (!newPlanId) return { status: "error", message: "Select a plan." };

  try {
    await changeHostingPlan(accountId, newPlanId, admin.id, { byAdmin: true });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Failed to change plan." };
  }

  revalidatePath(`/admin/hosting/${accountId}`);
  return { status: "idle" };
}

export async function suspendAdmin(accountId: string) {
  const admin = await requirePermission(PERMISSIONS.HOSTING_MANAGE);
  await suspendHostingAccount(accountId, admin.id);
  revalidatePath(`/admin/hosting/${accountId}`);
}

export async function unsuspendAdmin(accountId: string) {
  const admin = await requirePermission(PERMISSIONS.HOSTING_MANAGE);
  await unsuspendHostingAccount(accountId, admin.id);
  revalidatePath(`/admin/hosting/${accountId}`);
}

export async function terminateAdmin(accountId: string) {
  const admin = await requirePermission(PERMISSIONS.HOSTING_MANAGE);
  await terminateHostingAccount(accountId, admin.id, { byAdmin: true });
  revalidatePath(`/admin/hosting/${accountId}`);
}
