import "server-only";
import { prisma } from "@/lib/db";

export async function listVendors(schoolId: string) {
  return prisma.vendor.findMany({ where: { schoolId }, orderBy: { name: "asc" } });
}

export async function createVendor(schoolId: string, name: string, contactInfo?: string | null) {
  return prisma.vendor.create({ data: { schoolId, name, contactInfo: contactInfo || null } });
}

export async function listExpenseCategories(schoolId: string) {
  return prisma.expenseCategory.findMany({ where: { schoolId }, orderBy: { name: "asc" } });
}

export async function createExpenseCategory(schoolId: string, name: string) {
  return prisma.expenseCategory.create({ data: { schoolId, name } });
}

export async function listExpenses(schoolId: string, status?: "PENDING" | "APPROVED" | "REJECTED") {
  return prisma.expense.findMany({
    where: { schoolId, ...(status ? { status } : {}) },
    include: { category: true, vendor: true, createdBy: true, approvedBy: true },
    orderBy: { incurredAt: "desc" },
  });
}

export interface ExpenseInput {
  categoryId: string;
  vendorId?: string | null;
  description: string;
  amountMinor: number;
  incurredAt: Date;
}

/// Auto-approves anything under the school's configured threshold at
/// creation time; only expenses at or above it land as PENDING for an
/// owner/admin to review (brief: "expenses above X require owner
/// approval" — not every expense).
export async function recordExpense(schoolId: string, createdById: string, input: ExpenseInput) {
  const [category, school] = await Promise.all([
    prisma.expenseCategory.findFirst({ where: { id: input.categoryId, schoolId } }),
    prisma.school.findUniqueOrThrow({ where: { id: schoolId } }),
  ]);
  if (!category) throw new Error("Select a valid category.");
  if (input.vendorId) {
    const vendor = await prisma.vendor.findFirst({ where: { id: input.vendorId, schoolId } });
    if (!vendor) throw new Error("Select a valid vendor.");
  }

  const needsApproval = input.amountMinor >= school.expenseApprovalThresholdMinor;

  return prisma.expense.create({
    data: {
      schoolId,
      categoryId: input.categoryId,
      vendorId: input.vendorId || null,
      description: input.description,
      amountMinor: input.amountMinor,
      incurredAt: input.incurredAt,
      createdById,
      status: needsApproval ? "PENDING" : "APPROVED",
      approvedById: needsApproval ? null : createdById,
      approvedAt: needsApproval ? null : new Date(),
    },
  });
}

export async function approveExpense(schoolId: string, approvedById: string, id: string) {
  const expense = await prisma.expense.findFirst({ where: { schoolId, id } });
  if (!expense) throw new Error("Expense not found");
  if (expense.status !== "PENDING") throw new Error("This expense isn't pending.");

  return prisma.expense.update({
    where: { id },
    data: { status: "APPROVED", approvedById, approvedAt: new Date() },
  });
}

export async function rejectExpense(schoolId: string, approvedById: string, id: string) {
  const expense = await prisma.expense.findFirst({ where: { schoolId, id } });
  if (!expense) throw new Error("Expense not found");
  if (expense.status !== "PENDING") throw new Error("This expense isn't pending.");

  return prisma.expense.update({
    where: { id },
    data: { status: "REJECTED", approvedById, approvedAt: new Date() },
  });
}
