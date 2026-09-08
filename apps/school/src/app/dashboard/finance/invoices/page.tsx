import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { listInvoices, invoiceBalanceMinor } from "@/lib/services/invoices";
import { listClassArms, listTerms } from "@/lib/services/academics";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { GenerateInvoicesForm } from "./generate-form";

const STATUS_VARIANT = { ISSUED: "warning", PARTIALLY_PAID: "accent", PAID: "success", CANCELLED: "neutral" } as const;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ classArmId?: string; termId?: string; status?: string }>;
}) {
  const user = await requirePermission(PERMISSIONS.FINANCE_VIEW);
  const perms = await getUserPermissions(user.id);
  const canGenerate = perms.has(PERMISSIONS.FINANCE_MANAGE);

  const params = await searchParams;
  const [classArms, terms, school] = await Promise.all([
    listClassArms(user.schoolId),
    listTerms(user.schoolId),
    prisma.school.findUniqueOrThrow({ where: { id: user.schoolId } }),
  ]);

  const invoices = await listInvoices(user.schoolId, {
    classArmId: params.classArmId,
    termId: params.termId,
    status: params.status as never,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Invoices</h1>
          <p className="text-sm text-muted">{invoices.length} invoice{invoices.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="secondary"><Link href="/dashboard/finance/expenses">Expenses</Link></Button>
          {canGenerate && (
            <Button asChild variant="secondary"><Link href="/dashboard/finance/fee-structures">Fee structures</Link></Button>
          )}
        </div>
      </div>

      {canGenerate && (
        <Card>
          <CardHeader>
            <CardTitle>Generate invoices for a class</CardTitle>
            <CardDescription>Rolls every applicable fee structure into one invoice per active student.</CardDescription>
          </CardHeader>
          <CardContent>
            <GenerateInvoicesForm classArms={classArms} terms={terms} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-4">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="w-56 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="classArmId">Class</label>
              <Select id="classArmId" name="classArmId" defaultValue={params.classArmId ?? ""}>
                <option value="">All classes</option>
                {classArms.map((c) => <option key={c.id} value={c.id}>{c.classGroup.name} {c.name}</option>)}
              </Select>
            </div>
            <div className="w-56 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="termId">Term</label>
              <Select id="termId" name="termId" defaultValue={params.termId ?? ""}>
                <option value="">All terms</option>
                {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </div>
            <div className="w-44 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="status">Status</label>
              <Select id="status" name="status" defaultValue={params.status ?? ""}>
                <option value="">Any status</option>
                <option value="ISSUED">Issued</option>
                <option value="PARTIALLY_PAID">Partially paid</option>
                <option value="PAID">Paid</option>
              </Select>
            </div>
            <Button type="submit" variant="secondary">Filter</Button>
          </form>

          {invoices.length === 0 ? (
            <EmptyState title="No invoices found" description="Generate invoices for a class above to get started." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Link href={`/dashboard/finance/invoices/${inv.id}`} className="font-medium text-foreground hover:text-accent">
                        {inv.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{inv.student.firstName} {inv.student.lastName}</TableCell>
                    <TableCell className="text-muted">
                      {inv.student.classArm ? `${inv.student.classArm.classGroup.name} ${inv.student.classArm.name}` : "—"}
                    </TableCell>
                    <TableCell className="text-muted">{formatDate(inv.dueDate)}</TableCell>
                    <TableCell>{formatMoney(inv.totalMinor, school.currency)}</TableCell>
                    <TableCell>{formatMoney(invoiceBalanceMinor(inv), school.currency)}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[inv.status]}>{inv.status.replace("_", " ")}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
