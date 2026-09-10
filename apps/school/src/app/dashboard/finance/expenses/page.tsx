import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { listVendors, listExpenseCategories, listExpenses } from "@/lib/services/expenses";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { VendorForm, ExpenseCategoryForm, RecordExpenseForm } from "./forms";
import { ApprovalButtons } from "./approval-buttons";

const STATUS_VARIANT = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" } as const;

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requirePermission(PERMISSIONS.EXPENSES_VIEW);
  const perms = await getUserPermissions(user.id);
  const canApprove = perms.has(PERMISSIONS.EXPENSES_APPROVE);
  const canCreate = perms.has(PERMISSIONS.EXPENSES_CREATE);
  const params = await searchParams;

  const [vendors, categories, { expenses, page, pageCount }, school] = await Promise.all([
    listVendors(user.schoolId),
    listExpenseCategories(user.schoolId),
    listExpenses(user.schoolId, undefined, params.page ? Number(params.page) : 1),
    prisma.school.findUniqueOrThrow({ where: { id: user.schoolId } }),
  ]);

  return (
    <div className="max-w-4xl space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Expenses</h1>
          <p className="text-sm text-muted">
            Expenses of {formatMoney(school.expenseApprovalThresholdMinor, school.currency)} or more need approval.
          </p>
        </div>
        <Button asChild variant="secondary"><Link href="/dashboard/finance/invoices">Invoices</Link></Button>
      </div>

      {canCreate && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Vendors & categories</CardTitle>
              <CardDescription>Optional, but make expenses easier to filter later.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ExpenseCategoryForm />
              <VendorForm />
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => <Badge key={c.id} variant="neutral">{c.name}</Badge>)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Record an expense</CardTitle></CardHeader>
            <CardContent>
              <RecordExpenseForm categories={categories} vendors={vendors} />
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader><CardTitle>All expenses</CardTitle></CardHeader>
        <CardContent className="p-0">
          {expenses.length === 0 ? (
            <EmptyState title="No expenses recorded yet" className="p-8" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.description}</TableCell>
                    <TableCell className="text-muted">{e.category.name}</TableCell>
                    <TableCell className="text-muted">{e.vendor?.name ?? "—"}</TableCell>
                    <TableCell className="text-muted">{formatDate(e.incurredAt)}</TableCell>
                    <TableCell>{formatMoney(e.amountMinor, school.currency)}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[e.status]}>{e.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {e.status === "PENDING" && canApprove && <ApprovalButtons id={e.id} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="p-4 pt-0">
            <Pagination page={page} pageCount={pageCount} basePath="/dashboard/finance/expenses" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
