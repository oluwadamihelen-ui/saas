import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listSalaryComponents, getStaffSalaryStructure } from "@/lib/services/payroll";
import { prisma } from "@/lib/db";
import { StructureForm } from "./structure-form";

export default async function StaffSalaryStructurePage({ params }: { params: Promise<{ userId: string }> }) {
  const user = await requirePermission(PERMISSIONS.PAYROLL_MANAGE);
  const { userId } = await params;

  const staff = await prisma.user.findFirst({ where: { id: userId, schoolId: user.schoolId }, include: { role: true } });
  if (!staff) notFound();

  const [components, structure] = await Promise.all([
    listSalaryComponents(user.schoolId),
    getStaffSalaryStructure(user.schoolId, userId),
  ]);

  const existingAmountsMinor: Record<string, number> = {};
  for (const item of structure?.items ?? []) existingAmountsMinor[item.componentId] = item.amountMinor;

  return (
    <div className="max-w-2xl space-y-4 sm:space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm"><Link href="/dashboard/payroll">&larr; Payroll</Link></Button>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{staff.name}</h1>
        <p className="text-sm text-muted">{staff.role.name} · {staff.email}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Salary structure</CardTitle>
          <CardDescription>Leave an amount blank to leave that component out of this staff member&apos;s payslip.</CardDescription>
        </CardHeader>
        <CardContent>
          {components.length === 0 ? (
            <EmptyState title="No salary components yet" description="Add earning/deduction components from the Payroll page first." />
          ) : (
            <StructureForm userId={userId} components={components} existingAmountsMinor={existingAmountsMinor} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
