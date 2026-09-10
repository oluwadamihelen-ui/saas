"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { generateInvoicesForClass } from "@/lib/services/invoices";
import { logAudit } from "@/lib/audit";

export interface GenerateInvoicesState {
  status: "idle" | "error" | "success";
  message?: string;
}

const schema = z.object({
  classArmId: z.string().trim().min(1, "Choose a class"),
  termId: z.string().trim().min(1, "Choose a term"),
});

export async function generateInvoicesAction(
  _prev: GenerateInvoicesState,
  formData: FormData
): Promise<GenerateInvoicesState> {
  const user = await requirePermission(PERMISSIONS.FINANCE_MANAGE);
  const parsed = schema.safeParse({ classArmId: formData.get("classArmId"), termId: formData.get("termId") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your selections." };

  let result: { created: number; skipped: number };
  try {
    result = await generateInvoicesForClass(user.schoolId, parsed.data.classArmId, parsed.data.termId);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not generate invoices." };
  }

  await logAudit({
    schoolId: user.schoolId,
    userId: user.id,
    action: "invoices.generated",
    resourceType: "Invoice",
    resourceId: `${parsed.data.classArmId}:${parsed.data.termId}`,
    newValue: result,
  });

  revalidatePath("/dashboard/finance/invoices");
  return {
    status: "success",
    message: `Created ${result.created} invoice${result.created === 1 ? "" : "s"}${result.skipped ? `, ${result.skipped} already had one` : ""}.`,
  };
}
