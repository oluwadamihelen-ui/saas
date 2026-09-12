"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { createVendor, createExpenseCategory, recordExpense, approveExpense, rejectExpense } from "@/lib/services/expenses";
import { toMinorUnits } from "@/lib/money";
import { logAudit } from "@/lib/audit";

export interface FinanceFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function createVendorAction(_prev: FinanceFormState, formData: FormData): Promise<FinanceFormState> {
  const user = await requirePermission(PERMISSIONS.EXPENSES_CREATE);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { status: "error", message: "Enter a vendor name." };

  await createVendor(user.schoolId, name, String(formData.get("contactInfo") ?? "").trim() || null);
  revalidatePath("/dashboard/finance/expenses");
  return { status: "success" };
}

export async function createExpenseCategoryAction(_prev: FinanceFormState, formData: FormData): Promise<FinanceFormState> {
  const user = await requirePermission(PERMISSIONS.EXPENSES_CREATE);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { status: "error", message: "Enter a category name." };

  await createExpenseCategory(user.schoolId, name);
  revalidatePath("/dashboard/finance/expenses");
  return { status: "success" };
}

const expenseSchema = z.object({
  categoryId: z.string().trim().min(1, "Choose a category"),
  vendorId: z.string().trim().optional().or(z.literal("")),
  description: z.string().trim().min(1, "Enter a description").max(500),
  amount: z.coerce.number().positive("Enter an amount greater than 0"),
  incurredAt: z.coerce.date(),
});

export async function recordExpenseAction(_prev: FinanceFormState, formData: FormData): Promise<FinanceFormState> {
  const user = await requirePermission(PERMISSIONS.EXPENSES_CREATE);
  const parsed = expenseSchema.safeParse({
    categoryId: formData.get("categoryId"),
    vendorId: formData.get("vendorId") ?? "",
    description: formData.get("description"),
    amount: formData.get("amount"),
    incurredAt: formData.get("incurredAt"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  let expenseId: string;
  try {
    const expense = await recordExpense(user.schoolId, user.id, {
      categoryId: parsed.data.categoryId,
      vendorId: parsed.data.vendorId || null,
      description: parsed.data.description,
      amountMinor: toMinorUnits(parsed.data.amount),
      incurredAt: parsed.data.incurredAt,
    });
    expenseId = expense.id;
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not record expense." };
  }

  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "expense.recorded", resourceType: "Expense", resourceId: expenseId });
  revalidatePath("/dashboard/finance/expenses");
  return { status: "success" };
}

export async function approveExpenseAction(id: string) {
  const user = await requirePermission(PERMISSIONS.EXPENSES_APPROVE);
  await approveExpense(user.schoolId, user.id, id);
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "expense.approved", resourceType: "Expense", resourceId: id });
  revalidatePath("/dashboard/finance/expenses");
}

export async function rejectExpenseAction(id: string) {
  const user = await requirePermission(PERMISSIONS.EXPENSES_APPROVE);
  await rejectExpense(user.schoolId, user.id, id);
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "expense.rejected", resourceType: "Expense", resourceId: id });
  revalidatePath("/dashboard/finance/expenses");
}
