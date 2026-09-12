import "server-only";
import { prisma } from "@/lib/db";
import { getFinanceStats, getPendingApprovalsCount } from "@/lib/services/finance-dashboard";
import type { FinancialHealthMetrics, PeriodContext } from "./types";

const TREND_WEEKS = 6;

/// Confirmed-payment activity across the selected term's OWN invoices
/// only — never a global date range, which could silently mix payments
/// from another term. Grouped by week (a term runs ~3-4 months; daily
/// buckets would be too noisy to read at a glance).
async function getPaymentTrend(schoolId: string, termId: string): Promise<{ label: string; amountMinor: number }[]> {
  const payments = await prisma.payment.findMany({
    where: { schoolId, status: "CONFIRMED", paidAt: { not: null }, invoice: { termId } },
    select: { amountMinor: true, paidAt: true },
    orderBy: { paidAt: "asc" },
  });
  if (payments.length === 0) return [];

  const buckets = new Map<string, number>();
  for (const p of payments) {
    const date = p.paidAt!;
    // ISO week bucket key (Monday-based) — stable, sortable, locale-free.
    const monday = new Date(date);
    const day = (monday.getUTCDay() + 6) % 7; // 0 = Monday
    monday.setUTCDate(monday.getUTCDate() - day);
    monday.setUTCHours(0, 0, 0, 0);
    const key = monday.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + p.amountMinor);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-TREND_WEEKS)
    .map(([weekStart, amountMinor]) => ({ label: `Week of ${weekStart}`, amountMinor }));
}

/// Thin wrapper over the existing finance-dashboard.ts aggregates — this
/// file computes no revenue/outstanding/expense figures of its own. It
/// only adds "expected" (derived: collected + outstanding, since every
/// Invoice.totalMinor is fully accounted for by paid + remaining
/// balance) and a collection rate, plus the payment-trend bucketing.
export async function getFinancialHealth(schoolId: string, period: PeriodContext): Promise<FinancialHealthMetrics> {
  const [stats, pending] = await Promise.all([
    getFinanceStats(schoolId, period.termId),
    getPendingApprovalsCount(schoolId),
  ]);

  if (stats.totalInvoices === 0) {
    return {
      availability: "INSUFFICIENT_DATA",
      score: null,
      expectedMinor: 0,
      collectedMinor: 0,
      outstandingMinor: 0,
      collectionRatePercent: null,
      overdueInvoiceCount: 0,
      approvedExpensesMinor: 0,
      pendingExpenseApprovals: pending.pendingExpenses,
      pendingPaymentApprovals: pending.pendingPayments,
      paymentTrend: [],
    };
  }

  const expectedMinor = stats.revenueMinor + stats.outstandingMinor;
  const collectionRatePercent = expectedMinor > 0 ? Math.round((stats.revenueMinor / expectedMinor) * 100) : null;
  const paymentTrend = await getPaymentTrend(schoolId, period.termId);

  return {
    availability: "AVAILABLE",
    score: collectionRatePercent, // the component's 0-100 score IS the collection rate
    expectedMinor,
    collectedMinor: stats.revenueMinor,
    outstandingMinor: stats.outstandingMinor,
    collectionRatePercent,
    overdueInvoiceCount: stats.overdueCount,
    approvedExpensesMinor: stats.approvedExpensesMinor,
    pendingExpenseApprovals: pending.pendingExpenses,
    pendingPaymentApprovals: pending.pendingPayments,
    paymentTrend,
  };
}
