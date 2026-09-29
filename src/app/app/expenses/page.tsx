import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import { requirePermission, getUserPermissions } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { formatCurrency, formatDate } from "@/lib/utils";
import { listExpenses } from "@/lib/services/expenses";
import { ExpenseForm } from "./expense-form";
import { DeleteExpenseButton } from "./delete-button";

export const metadata: Metadata = { title: "Expenses" };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requirePermission(PERMISSIONS.EXPENSES_VIEW);
  const perms = await getUserPermissions(user.id, user.hotelId);
  const canManage = perms.has(PERMISSIONS.EXPENSES_MANAGE);
  const params = await searchParams;
  const currency = user.hotelCurrency ?? "USD";

  const { items, page, pageCount, totalAmount } = await listExpenses(user.hotelId, { page: params.page ? Number(params.page) : 1 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
        <Card>
          <CardContent className="px-4 py-2">
            <p className="text-xs text-muted">Total (this page)</p>
            <p className="text-lg font-semibold text-foreground">{formatCurrency(totalAmount, currency)}</p>
          </CardContent>
        </Card>
      </div>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Record an expense</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpenseForm />
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        <EmptyState icon={<Receipt className="h-6 w-6" />} title="No expenses recorded" description="Track electricity, salaries, supplies, and other operating costs here." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted-surface text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3">Reference</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Vendor</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Recorded By</th>
                  {canManage && <th className="px-5 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((e) => (
                  <tr key={e.id} className="hover:bg-muted-surface/50">
                    <td className="px-5 py-3 font-medium text-foreground">{e.reference}</td>
                    <td className="px-5 py-3 text-muted">{e.category.replaceAll("_", " ")}</td>
                    <td className="px-5 py-3 text-muted">{e.vendor ?? "—"}</td>
                    <td className="px-5 py-3 text-muted">{formatCurrency(e.amount, currency)}</td>
                    <td className="px-5 py-3 text-muted">{formatDate(e.date)}</td>
                    <td className="px-5 py-3 text-muted">{e.recordedBy?.name ?? "—"}</td>
                    {canManage && (
                      <td className="px-5 py-3">
                        <DeleteExpenseButton id={e.id} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination basePath="/app/expenses" page={page} pageCount={pageCount} />
        </Card>
      )}
    </div>
  );
}
