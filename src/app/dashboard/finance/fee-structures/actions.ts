"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { createFeeCategory, deleteFeeCategory, createFeeStructure, deleteFeeStructure } from "@/lib/services/fee-structures";
import { toMinorUnits } from "@/lib/money";

export interface FinanceFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

const categorySchema = z.object({ name: z.string().trim().min(1).max(50) });

export async function createFeeCategoryAction(_prev: FinanceFormState, formData: FormData): Promise<FinanceFormState> {
  const user = await requirePermission(PERMISSIONS.FINANCE_MANAGE);
  const parsed = categorySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { status: "error", message: "Enter a category name." };

  await createFeeCategory(user.schoolId, parsed.data.name);
  revalidatePath("/dashboard/finance/fee-structures");
  return { status: "success" };
}

export async function deleteFeeCategoryAction(id: string) {
  const user = await requirePermission(PERMISSIONS.FINANCE_MANAGE);
  await deleteFeeCategory(user.schoolId, id);
  revalidatePath("/dashboard/finance/fee-structures");
}

const structureSchema = z.object({
  name: z.string().trim().min(1).max(100),
  categoryId: z.string().trim().min(1, "Choose a category"),
  classGroupId: z.string().trim().optional().or(z.literal("")),
  termId: z.string().trim().min(1, "Choose a term"),
  amount: z.coerce.number().positive("Enter an amount greater than 0"),
});

export async function createFeeStructureAction(_prev: FinanceFormState, formData: FormData): Promise<FinanceFormState> {
  const user = await requirePermission(PERMISSIONS.FINANCE_MANAGE);
  const parsed = structureSchema.safeParse({
    name: formData.get("name"),
    categoryId: formData.get("categoryId"),
    classGroupId: formData.get("classGroupId") ?? "",
    termId: formData.get("termId"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    await createFeeStructure(user.schoolId, {
      name: parsed.data.name,
      categoryId: parsed.data.categoryId,
      classGroupId: parsed.data.classGroupId || null,
      termId: parsed.data.termId,
      amountMinor: toMinorUnits(parsed.data.amount),
    });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not create fee structure." };
  }

  revalidatePath("/dashboard/finance/fee-structures");
  return { status: "success" };
}

export async function deleteFeeStructureAction(id: string) {
  const user = await requirePermission(PERMISSIONS.FINANCE_MANAGE);
  await deleteFeeStructure(user.schoolId, id);
  revalidatePath("/dashboard/finance/fee-structures");
}
