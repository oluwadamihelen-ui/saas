import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { listSalaryComponents, listStaffSalaryStructures, listPayrollRuns } from "@/lib/services/payroll";
import { listAllStaff } from "@/lib/services/staff";
import { SalaryComponentForm, GeneratePayrollRunForm } from "./forms";
import { RunActions } from "./run-actions";

const STATUS_VARIANT = { DRAFT: "warning", APPROVED: "accent", PAID: "success" } as const;
const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString("en-US", { month: "long" }));

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requirePermission(PERMISSIONS.PAYROLL_VIEW);
  const perms = await getUserPermissions(user.id);
  const canManage = perms.has(PERMISSIONS.PAYROLL_MANAGE);
  const canApprove = perms.has(PERMISSIONS.PAYROLL_APPROVE);
  const params = await searchParams;

  const [components, structures, staff, { runs, total, page, pageCount }] = await Promise.all([
    listSalaryComponents(user.schoolId),
    listStaffSalaryStructures(user.schoolId),
    listAllStaff(user.schoolId),
    listPayrollRuns(user.schoolId, params.page ? Number(params.page) : 1),
  ]);

  const structuredUserIds = new Set(structures.map((s) => s.userId));
  const unstructuredStaff = staff.filter((s) => !structuredUserIds.has(s.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Payroll</h1>
        <p className="text-sm text-muted">{total} payroll run{total === 1 ? "" : "s"} generated</p>
      </div>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Salary components</CardTitle>
            <CardDescription>The earnings and deductions available when building a staff member&apos;s salary structure.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SalaryComponentForm />
            <div className="flex flex-wrap gap-2">
              {components.map((c) => (
                <Badge key={c.id} variant={c.type === "EARNING" ? "success" : "danger"}>{c.name}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Staff salary structures</CardTitle>
          <CardDescription>Only staff with a structure configured are included when a payroll run is generated.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {staff.length === 0 ? (
            <EmptyState title="No staff yet" className="p-8" />
          ) : (
            <ul className="divide-y divide-border">
              {structures.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{s.user.name}</p>
                    <p className="text-xs text-muted">{s.user.role.name}</p>
                  </div>
                  {canManage ? (
                    <Link href={`/dashboard/payroll/staff/${s.userId}`} className="text-sm text-accent hover:underline">
                      Edit structure
                    </Link>
                  ) : (
                    <Badge variant="success">Configured</Badge>
                  )}
                </li>
              ))}
              {unstructuredStaff.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{s.name}</p>
                    <p className="text-xs text-muted">{s.role.name}</p>
                  </div>
                  {canManage ? (
                    <Link href={`/dashboard/payroll/staff/${s.id}`} className="text-sm text-accent hover:underline">
                      Set up structure
                    </Link>
                  ) : (
                    <Badge variant="neutral">Not configured</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader><CardTitle>Generate a payroll run</CardTitle></CardHeader>
          <CardContent><GeneratePayrollRunForm /></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Payroll runs</CardTitle></CardHeader>
        <CardContent className="space-y-4 p-0">
          {runs.length === 0 ? (
            <EmptyState title="No payroll runs yet" className="p-8" />
          ) : (
            <ul className="divide-y divide-border">
              {runs.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <Link href={`/dashboard/payroll/runs/${r.id}`} className="flex-1">
                    <p className="font-medium text-foreground">{MONTH_NAMES[r.month - 1]} {r.year}</p>
                    <p className="text-xs text-muted">
                      {r._count.payslips} payslip{r._count.payslips === 1 ? "" : "s"} · created by {r.createdBy.name}
                    </p>
                  </Link>
                  <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                  {canApprove && <RunActions id={r.id} status={r.status} />}
                </li>
              ))}
            </ul>
          )}
          <div className="p-4 pt-0">
            <Pagination page={page} pageCount={pageCount} basePath="/dashboard/payroll" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
