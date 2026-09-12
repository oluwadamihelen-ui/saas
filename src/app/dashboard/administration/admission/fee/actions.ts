"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { setAdmissionFee } from "@/lib/services/admission";
import { toMinorUnits } from "@/lib/money";
import { logAudit } from "@/lib/audit";

export interface AdmissionFeeFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

const feeSchema = z.object({
  amount: z.string().trim().optional().or(z.literal("")),
});

export async function setAdmissionFeeAction(_prev: AdmissionFeeFormState, formData: FormData): Promise<AdmissionFeeFormState> {
  const user = await requirePermission(PERMISSIONS.ADMISSION_MANAGE);
  const parsed = feeSchema.safeParse({ amount: formData.get("amount") ?? "" });
  if (!parsed.success) return { status: "error", message: "Enter a valid amount." };

  const raw = parsed.data.amount?.trim();
  const amountMinor = raw ? toMinorUnits(Number(raw)) : null;
  if (raw && (!Number.isFinite(amountMinor) || (amountMinor ?? 0) < 0)) {
    return { status: "error", message: "Enter a valid, non-negative amount." };
  }

  await setAdmissionFee(user.schoolId, amountMinor);
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "admission.fee_updated", resourceType: "School", resourceId: user.schoolId });
  revalidatePath("/dashboard/administration/admission/fee");
  return { status: "success", message: "Admission fee updated." };
}
