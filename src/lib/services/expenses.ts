import { prisma } from "@/lib/db";
import type { ExpenseCategory } from "@/generated/prisma/enums";
import { recordAuditLog } from "@/lib/security/audit";
import { generateExpenseReference } from "@/lib/utils/ids";

export interface ExpenseInput {
  category: ExpenseCategory;
  amount: number;
  date: Date;
  description?: string;
  vendor?: string;
  receiptUrl?: string;
}

export async function listExpenses(hotelId: string, filters?: { category?: ExpenseCategory; from?: Date; to?: Date; page?: number; pageSize?: number }) {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const where = {
    hotelId,
    ...(filters?.category ? { category: filters.category } : {}),
    ...(filters?.from || filters?.to ? { date: { gte: filters?.from, lte: filters?.to } } : {}),
  };

  const [items, total, totalAgg] = await Promise.all([
    prisma.expense.findMany({ where, include: { recordedBy: { select: { name: true } } }, orderBy: { date: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.expense.count({ where }),
    prisma.expense.aggregate({ where, _sum: { amount: true } }),
  ]);

  return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)), totalAmount: Number(totalAgg._sum.amount ?? 0) };
}

export async function createExpense(hotelId: string, actorId: string | null, input: ExpenseInput) {
  if (input.amount <= 0) throw new Error("Expense amount must be greater than zero");
  const expense = await prisma.expense.create({
    data: { hotelId, reference: generateExpenseReference(), category: input.category, amount: input.amount, date: input.date, description: input.description, vendor: input.vendor, receiptUrl: input.receiptUrl, recordedById: actorId },
  });
  await recordAuditLog({ hotelId, actorId, action: "expense.recorded", resourceType: "Expense", resourceId: expense.id, newValue: { category: input.category, amount: input.amount } });
  return expense;
}

export async function deleteExpense(hotelId: string, actorId: string, expenseId: string) {
  const expense = await prisma.expense.findFirst({ where: { id: expenseId, hotelId } });
  if (!expense) throw new Error("Expense not found");
  await prisma.expense.delete({ where: { id: expenseId } });
  await recordAuditLog({ hotelId, actorId, action: "expense.deleted", resourceType: "Expense", resourceId: expenseId, oldValue: { category: expense.category, amount: expense.amount.toString() } });
}

export async function expensesByCategory(hotelId: string, from: Date, to: Date) {
  const rows = await prisma.expense.groupBy({ by: ["category"], where: { hotelId, date: { gte: from, lte: to } }, _sum: { amount: true } });
  return rows.map((r) => ({ category: r.category, total: Number(r._sum.amount ?? 0) })).sort((a, b) => b.total - a.total);
}
