import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { getPayrollRun } from "@/lib/services/payroll";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { RunActions } from "../../run-actions";

const STATUS_VARIANT = { DRAFT: "warning", APPROVED: "accent", PAID: "success" } as const;
const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString("en-US", { month: "long" }));

interface PayslipItem {
  componentName: string;
  type: "EARNING" | "DEDUCTION";
  amountMinor: number;
}

export default async function PayrollRunPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(PERMISSIONS.PAYROLL_VIEW);
  const perms = await getUserPermissions(user.id);
  const canApprove = perms.has(PERMISSIONS.PAYROLL_APPROVE);
  const { id } = await params;

  const [run, school] = await Promise.all([
    getPayrollRun(user.schoolId, id),
    prisma.school.findUniqueOrThrow({ where: { id: user.schoolId } }),
  ]);
  if (!run) notFound();

  const totalGross = run.payslips.reduce((sum, p) => sum + p.grossMinor, 0);
  const totalNet = run.payslips.reduce((sum, p) => sum + p.netMinor, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm"><Link href="/dashboard/payroll">&larr; Payroll</Link></Button>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {MONTH_NAMES[run.month - 1]} {run.year} payroll
          </h1>
          <p className="text-sm text-muted">
            {run.payslips.length} payslip{run.payslips.length === 1 ? "" : "s"} · Gross {formatMoney(totalGross, school.currency)} · Net {formatMoney(totalNet, school.currency)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[run.status]}>{run.status}</Badge>
          {canApprove && <RunActions id={run.id} status={run.status} />}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Payslips</CardTitle></CardHeader>
        <CardContent className="space-y-4 p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Breakdown</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {run.payslips.map((p) => {
                const items = p.items as unknown as PayslipItem[];
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{p.user.name}</p>
                      <p className="text-xs text-muted">{p.user.role.name}</p>
                    </TableCell>
                    <TableCell className="text-xs text-muted">
                      {items.map((i) => `${i.componentName}: ${formatMoney(i.amountMinor, school.currency)}`).join(", ")}
                    </TableCell>
                    <TableCell className="text-muted">{formatMoney(p.grossMinor, school.currency)}</TableCell>
                    <TableCell className="text-muted">{formatMoney(p.totalDeductionsMinor, school.currency)}</TableCell>
                    <TableCell className="font-medium text-foreground">{formatMoney(p.netMinor, school.currency)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
