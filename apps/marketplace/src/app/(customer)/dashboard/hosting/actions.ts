"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/require";
import { changeHostingPlan, terminateHostingAccount } from "@/lib/services/hosting-accounts";

export interface HostingActionState {
  status: "idle" | "error";
  message?: string;
}

async function requireOwnedAccount(accountId: string, customerId: string) {
  const account = await prisma.hostingAccount.findFirst({ where: { id: accountId, customerId } });
  if (!account) throw new Error("Hosting account not found");
  return account;
}

export async function changePlan(accountId: string, _prev: HostingActionState, formData: FormData): Promise<HostingActionState> {
  const user = await requireUser();
  await requireOwnedAccount(accountId, user.id);

  const newPlanId = String(formData.get("newPlanId") || "");
  if (!newPlanId) return { status: "error", message: "Select a plan." };

  try {
    await changeHostingPlan(accountId, newPlanId, user.id);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Failed to change plan." };
  }

  revalidatePath(`/dashboard/hosting/${accountId}`);
  return { status: "idle" };
}

export async function cancelHosting(accountId: string) {
  const user = await requireUser();
  await requireOwnedAccount(accountId, user.id);
  await terminateHostingAccount(accountId, user.id);
  revalidatePath(`/dashboard/hosting/${accountId}`);
}
