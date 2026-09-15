import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { getFinanceStats, getPendingApprovalsCount } from "@/lib/services/finance-dashboard";
import { getCurrentTerm } from "@/lib/services/academics";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/db";

export default async function FinanceDashboardPage() {
  const user = await requirePermission(PERMISSIONS.FINANCE_VIEW);
  const [school, currentTerm] = await Promise.all([
    prisma.school.findUniqueOrThrow({ where: { id: user.schoolId } }),
    getCurrentTerm(user.schoolId),
  ]);
  const [stats, approvals] = await Promise.all([
    getFinanceStats(user.schoolId, currentTerm?.id),
    getPendingApprovalsCount(user.schoolId),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Finance</h1>
          <p className="text-sm text-muted">{currentTerm ? currentTerm.name : "No active term"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="secondary"><Link href="/dashboard/finance/expenses">Expenses</Link></Button>
          <Button asChild variant="secondary"><Link href="/dashboard/finance/fee-structures">Fee structures</Link></Button>
          <Button asChild><Link href="/dashboard/finance/invoices">Invoices</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue this term" value={formatMoney(stats.revenueMinor, school.currency)} hint={`${stats.totalInvoices} invoices`} />
        <StatCard label="Outstanding fees" value={formatMoney(stats.outstandingMinor, school.currency)} />
        <StatCard label="Overdue accounts" value={stats.overdueCount} hint="past due date, unpaid" />
        <StatCard label="Approved expenses" value={formatMoney(stats.approvedExpensesMinor, school.currency)} />
      </div>

      {(approvals.pendingExpenses > 0 || approvals.pendingPayments > 0) && (
        <Card>
          <CardContent className="flex items-center justify-between">
            <p className="text-sm text-foreground">
              {approvals.pendingExpenses > 0 && <>{approvals.pendingExpenses} expense{approvals.pendingExpenses === 1 ? "" : "s"} awaiting approval</>}
              {approvals.pendingExpenses > 0 && approvals.pendingPayments > 0 && " · "}
              {approvals.pendingPayments > 0 && <>{approvals.pendingPayments} bank transfer{approvals.pendingPayments === 1 ? "" : "s"} awaiting confirmation</>}
            </p>
            <Button asChild size="sm" variant="secondary"><Link href="/dashboard/finance/expenses">Review</Link></Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Revenue by class</CardTitle></CardHeader>
        <CardContent>
          {stats.byClass.length === 0 ? (
            <EmptyState title="No invoices yet this term" description="Generate invoices for a class to see revenue here." />
          ) : (
            <ul className="divide-y divide-border">
              {stats.byClass.map((c) => (
                <li key={c.name} className="flex items-center justify-between py-3 text-sm">
                  <span className="font-medium text-foreground">{c.name}</span>
                  <div className="flex items-center gap-4 text-muted">
                    <span>{formatMoney(c.revenueMinor, school.currency)} collected</span>
                    <span>{formatMoney(c.outstandingMinor, school.currency)} outstanding</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
