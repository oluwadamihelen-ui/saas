"use server";

import { revalidatePath } from "next/cache";
import { requirePartner, withAuthErrors } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { requestWithdrawal, cancelWithdrawal } from "@/lib/services/partner-withdrawals";

export interface PartnerActionState {
  status: "idle" | "error" | "success";
  message?: string;
}

async function requirePartnerProfile() {
  const user = await requirePartner();
  return prisma.partner.findUniqueOrThrow({ where: { userId: user.id } });
}

export const requestWithdrawalAction = withAuthErrors(async function requestWithdrawalAction(_prev: PartnerActionState, _formData: FormData): Promise<PartnerActionState> {
  const partner = await requirePartnerProfile();
  try {
    await requestWithdrawal(partner.id);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not request a withdrawal." };
  }
  revalidatePath("/partner");
  return { status: "success" };
});

export async function cancelWithdrawalAction(withdrawalId: string) {
  const partner = await requirePartnerProfile();
  await cancelWithdrawal(withdrawalId, partner.id);
  revalidatePath("/partner");
}
