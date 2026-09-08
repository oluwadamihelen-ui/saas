import "server-only";
import { prisma } from "@/lib/db";

export async function getFinanceStats(schoolId: string, termId: string | undefined) {
  const invoices = await prisma.invoice.findMany({
    where: { schoolId, ...(termId ? { termId } : {}) },
    include: {
      payments: true,
      student: { include: { classArm: { include: { classGroup: true } } } },
    },
  });

  const today = new Date();
  let revenueMinor = 0;
  let outstandingMinor = 0;
  let overdueCount = 0;
  const byClass = new Map<string, { name: string; revenueMinor: number; outstandingMinor: number }>();

  for (const invoice of invoices) {
    const paid = invoice.payments.filter((p) => p.status === "CONFIRMED").reduce((sum, p) => sum + p.amountMinor, 0);
    const balance = Math.max(0, invoice.totalMinor - paid);

    revenueMinor += paid;
    outstandingMinor += balance;
    if (balance > 0 && invoice.dueDate < today) overdueCount += 1;

    const className = invoice.student.classArm
      ? `${invoice.student.classArm.classGroup.name}`
      : "Unassigned";
    if (!byClass.has(className)) byClass.set(className, { name: className, revenueMinor: 0, outstandingMinor: 0 });
    const entry = byClass.get(className)!;
    entry.revenueMinor += paid;
    entry.outstandingMinor += balance;
  }

  const expenses = await prisma.expense.aggregate({
    where: { schoolId, status: "APPROVED" },
    _sum: { amountMinor: true },
  });

  return {
    revenueMinor,
    outstandingMinor,
    overdueCount,
    totalInvoices: invoices.length,
    approvedExpensesMinor: expenses._sum.amountMinor ?? 0,
    byClass: Array.from(byClass.values()).sort((a, b) => b.revenueMinor - a.revenueMinor),
  };
}

export async function getPendingApprovalsCount(schoolId: string) {
  const [pendingExpenses, pendingPayments] = await Promise.all([
    prisma.expense.count({ where: { schoolId, status: "PENDING" } }),
    prisma.payment.count({ where: { schoolId, status: "PENDING" } }),
  ]);
  return { pendingExpenses, pendingPayments };
}
