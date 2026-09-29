"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { createExpense, deleteExpense } from "@/lib/services/expenses";
import type { ExpenseCategory } from "@/generated/prisma/enums";

const expenseSchema = z.object({
  category: z.custom<ExpenseCategory>((v) => typeof v === "string"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than zero"),
  date: z.string().min(1),
  description: z.string().trim().max(1000).optional(),
  vendor: z.string().trim().max(200).optional(),
});

export interface ExpenseFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function createExpenseAction(_prev: ExpenseFormState, formData: FormData): Promise<ExpenseFormState> {
  const user = await requirePermission(PERMISSIONS.EXPENSES_MANAGE);
  const parsed = expenseSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };

  try {
    await createExpense(user.hotelId, user.id, { ...parsed.data, date: new Date(parsed.data.date) });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Unable to record expense." };
  }

  revalidatePath("/app/expenses");
  return { status: "success" };
}

export async function deleteExpenseAction(id: string) {
  const user = await requirePermission(PERMISSIONS.EXPENSES_MANAGE);
  await deleteExpense(user.hotelId, user.id, id);
  revalidatePath("/app/expenses");
}
