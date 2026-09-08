"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createSalaryComponent,
  upsertStaffSalaryStructure,
  generatePayrollRun,
  approvePayrollRun,
  markPayrollRunPaid,
} from "@/lib/services/payroll";
import { toMinorUnits } from "@/lib/money";
import { logAudit } from "@/lib/audit";

export interface PayrollFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

const componentSchema = z.object({
  name: z.string().trim().min(1, "Enter a component name"),
  type: z.enum(["EARNING", "DEDUCTION"]),
});

export async function createSalaryComponentAction(_prev: PayrollFormState, formData: FormData): Promise<PayrollFormState> {
  const user = await requirePermission(PERMISSIONS.PAYROLL_MANAGE);
  const parsed = componentSchema.safeParse({ name: formData.get("name"), type: formData.get("type") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  await createSalaryComponent(user.schoolId, parsed.data.name, parsed.data.type);
  revalidatePath("/dashboard/payroll");
  return { status: "success" };
}

export async function saveStaffSalaryStructureAction(_prev: PayrollFormState, formData: FormData): Promise<PayrollFormState> {
  const user = await requirePermission(PERMISSIONS.PAYROLL_MANAGE);

  const userId = String(formData.get("userId") ?? "");
  const componentIds = formData.getAll("componentId").map(String);
  const amounts = formData.getAll("amount").map(String);
  const items = componentIds
    .map((componentId, i) => ({ componentId, amount: Number(amounts[i]) }))
    .filter((i) => i.componentId && Number.isFinite(i.amount) && i.amount > 0)
    .map((i) => ({ componentId: i.componentId, amountMinor: toMinorUnits(i.amount) }));

  try {
    await upsertStaffSalaryStructure(user.schoolId, userId, items);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not save the salary structure." };
  }

  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "payroll.structure_saved", resourceType: "StaffSalaryStructure", resourceId: userId });
  revalidatePath(`/dashboard/payroll/staff/${userId}`);
  revalidatePath("/dashboard/payroll");
  return { status: "success" };
}

const runSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

export async function generatePayrollRunAction(_prev: PayrollFormState, formData: FormData): Promise<PayrollFormState> {
  const user = await requirePermission(PERMISSIONS.PAYROLL_MANAGE);
  const parsed = runSchema.safeParse({ month: formData.get("month"), year: formData.get("year") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the month/year." };

  let runId: string;
  try {
    const run = await generatePayrollRun(user.schoolId, parsed.data.month, parsed.data.year, user.id);
    runId = run.id;
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not generate the payroll run." };
  }

  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "payroll.run_generated", resourceType: "PayrollRun", resourceId: runId });
  revalidatePath("/dashboard/payroll");
  return { status: "success", message: "Payroll run generated." };
}

export async function approvePayrollRunAction(id: string) {
  const user = await requirePermission(PERMISSIONS.PAYROLL_APPROVE);
  await approvePayrollRun(user.schoolId, user.id, id);
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "payroll.run_approved", resourceType: "PayrollRun", resourceId: id });
  revalidatePath("/dashboard/payroll");
  revalidatePath(`/dashboard/payroll/runs/${id}`);
}

export async function markPayrollRunPaidAction(id: string) {
  const user = await requirePermission(PERMISSIONS.PAYROLL_APPROVE);
  await markPayrollRunPaid(user.schoolId, id);
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "payroll.run_paid", resourceType: "PayrollRun", resourceId: id });
  revalidatePath("/dashboard/payroll");
  revalidatePath(`/dashboard/payroll/runs/${id}`);
}
