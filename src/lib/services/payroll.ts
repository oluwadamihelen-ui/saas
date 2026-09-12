import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma, SalaryComponentType } from "@/generated/prisma/client";

export async function listSalaryComponents(schoolId: string) {
  return prisma.salaryComponent.findMany({ where: { schoolId }, orderBy: { name: "asc" } });
}

export async function createSalaryComponent(schoolId: string, name: string, type: SalaryComponentType) {
  return prisma.salaryComponent.create({ data: { schoolId, name, type } });
}

export async function listStaffSalaryStructures(schoolId: string) {
  return prisma.staffSalaryStructure.findMany({
    where: { schoolId },
    include: { user: { include: { role: true } }, items: { include: { component: true } } },
    orderBy: { user: { name: "asc" } },
  });
}

export async function getStaffSalaryStructure(schoolId: string, userId: string) {
  return prisma.staffSalaryStructure.findFirst({
    where: { schoolId, userId },
    include: { items: { include: { component: true } } },
  });
}

/// Replaces the staff member's entire item set with the given one — the
/// salary editor always submits the full structure, not a delta, so this
/// stays a delete-then-recreate rather than a diff.
export async function upsertStaffSalaryStructure(
  schoolId: string,
  userId: string,
  items: { componentId: string; amountMinor: number }[]
) {
  const staff = await prisma.user.findFirst({ where: { id: userId, schoolId } });
  if (!staff) throw new Error("Staff member not found.");

  const structure = await prisma.staffSalaryStructure.upsert({
    where: { userId },
    create: { schoolId, userId },
    update: {},
  });

  await prisma.staffSalaryItem.deleteMany({ where: { structureId: structure.id } });
  if (items.length > 0) {
    await prisma.staffSalaryItem.createMany({
      data: items.map((i) => ({ structureId: structure.id, componentId: i.componentId, amountMinor: i.amountMinor })),
    });
  }
  return structure;
}

const PAYROLL_RUN_PAGE_SIZE = 20;

export async function listPayrollRuns(schoolId: string, page = 1) {
  const currentPage = Math.max(1, page);
  const where: Prisma.PayrollRunWhereInput = { schoolId };
  const [runs, total] = await Promise.all([
    prisma.payrollRun.findMany({
      where,
      include: { createdBy: true, approvedBy: true, _count: { select: { payslips: true } } },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      skip: (currentPage - 1) * PAYROLL_RUN_PAGE_SIZE,
      take: PAYROLL_RUN_PAGE_SIZE,
    }),
    prisma.payrollRun.count({ where }),
  ]);
  return { runs, total, page: currentPage, pageCount: Math.max(1, Math.ceil(total / PAYROLL_RUN_PAGE_SIZE)) };
}

export async function getPayrollRun(schoolId: string, id: string) {
  return prisma.payrollRun.findFirst({
    where: { schoolId, id },
    include: {
      createdBy: true,
      approvedBy: true,
      payslips: { include: { user: { include: { role: true } } }, orderBy: { user: { name: "asc" } } },
    },
  });
}

/// Generates one payslip per staff member who has a salary structure
/// configured, snapshotting their current StaffSalaryItem rows into
/// Payslip.items so later edits to the structure (or the component
/// catalog) never change an already-generated payslip. Only a DRAFT run
/// can be (re-)generated — this replaces its payslips wholesale, so it's
/// safe to re-run after onboarding a new staff member or correcting a
/// structure, but APPROVED/PAID runs are locked.
export async function generatePayrollRun(schoolId: string, month: number, year: number, createdById: string) {
  const structures = await prisma.staffSalaryStructure.findMany({
    where: { schoolId },
    include: { items: { include: { component: true } } },
  });
  if (structures.length === 0) throw new Error("No staff have a salary structure configured yet.");

  const run = await prisma.payrollRun.upsert({
    where: { schoolId_month_year: { schoolId, month, year } },
    create: { schoolId, month, year, createdById },
    update: {},
  });
  if (run.status !== "DRAFT") throw new Error("This payroll run is already approved and can't be regenerated.");

  await prisma.payslip.deleteMany({ where: { payrollRunId: run.id } });

  const rows: Prisma.PayslipCreateManyInput[] = structures.map((s) => {
    const gross = s.items.filter((i) => i.component.type === "EARNING").reduce((sum, i) => sum + i.amountMinor, 0);
    const deductions = s.items.filter((i) => i.component.type === "DEDUCTION").reduce((sum, i) => sum + i.amountMinor, 0);
    return {
      schoolId,
      payrollRunId: run.id,
      userId: s.userId,
      items: s.items.map((i) => ({ componentName: i.component.name, type: i.component.type, amountMinor: i.amountMinor })),
      grossMinor: gross,
      totalDeductionsMinor: deductions,
      netMinor: gross - deductions,
    };
  });

  await prisma.payslip.createMany({ data: rows });
  return run;
}

export async function approvePayrollRun(schoolId: string, approvedById: string, id: string) {
  const run = await prisma.payrollRun.findFirst({ where: { schoolId, id } });
  if (!run) throw new Error("Payroll run not found.");
  if (run.status !== "DRAFT") throw new Error("Only a draft payroll run can be approved.");
  return prisma.payrollRun.update({ where: { id }, data: { status: "APPROVED", approvedById, approvedAt: new Date() } });
}

export async function markPayrollRunPaid(schoolId: string, id: string) {
  const run = await prisma.payrollRun.findFirst({ where: { schoolId, id } });
  if (!run) throw new Error("Payroll run not found.");
  if (run.status !== "APPROVED") throw new Error("Only an approved payroll run can be marked paid.");
  return prisma.payrollRun.update({ where: { id }, data: { status: "PAID", paidAt: new Date() } });
}
