import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma, SchoolStatus, SubscriptionStatus, BillingInterval, PlatformInvoiceStatus } from "@/generated/prisma/client";

export async function getPlatformStats() {
  const [schoolsByStatus, totalStudents, activeSubscriptions, trialingSubscriptions, overdueInvoices] =
    await Promise.all([
      prisma.school.groupBy({ by: ["status"], _count: true }),
      prisma.student.count({ where: { status: "ACTIVE" } }),
      prisma.subscription.findMany({ where: { status: "ACTIVE" }, include: { plan: true } }),
      prisma.subscription.count({ where: { status: "TRIALING" } }),
      prisma.platformInvoice.count({ where: { status: "OVERDUE" } }),
    ]);

  const statusCounts: Record<SchoolStatus, number> = { TRIAL: 0, ACTIVE: 0, SUSPENDED: 0 };
  for (const row of schoolsByStatus) statusCounts[row.status] = row._count;
  const totalSchools = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  /// MRR only counts paying (ACTIVE) subscriptions, not TRIALING ones —
  /// standard SaaS convention, since a trial hasn't actually paid yet.
  /// Yearly plans are normalized to a monthly-equivalent amount.
  const mrrMinor = activeSubscriptions.reduce((sum, s) => {
    const monthly = s.plan.billingInterval === "YEARLY" ? Math.round(s.plan.priceMinor / 12) : s.plan.priceMinor;
    return sum + monthly;
  }, 0);

  return { totalSchools, statusCounts, totalStudents, activeSubscriptionCount: activeSubscriptions.length, trialingSubscriptions, overdueInvoices, mrrMinor };
}

const SCHOOL_PAGE_SIZE = 20;

export async function listSchoolsForPlatform(search: string | undefined, page = 1) {
  const currentPage = Math.max(1, page);
  const where: Prisma.SchoolWhereInput = search
    ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { slug: { contains: search, mode: "insensitive" } }] }
    : {};

  const [schools, total] = await Promise.all([
    prisma.school.findMany({
      where,
      include: { subscription: { include: { plan: true } }, _count: { select: { students: true, users: true } } },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * SCHOOL_PAGE_SIZE,
      take: SCHOOL_PAGE_SIZE,
    }),
    prisma.school.count({ where }),
  ]);

  return { schools, total, page: currentPage, pageCount: Math.max(1, Math.ceil(total / SCHOOL_PAGE_SIZE)) };
}

export async function getSchoolForPlatform(id: string) {
  return prisma.school.findUnique({
    where: { id },
    include: {
      subscription: { include: { plan: true } },
      _count: { select: { students: true, users: true } },
      platformInvoices: { orderBy: { periodStart: "desc" }, include: { markedPaidBy: true } },
    },
  });
}

export async function updateSchoolStatus(schoolId: string, status: SchoolStatus) {
  return prisma.school.update({ where: { id: schoolId }, data: { status } });
}

export async function changeSchoolPlan(schoolId: string, planId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { schoolId } });
  if (!subscription) throw new Error("This school has no subscription to change.");
  return prisma.subscription.update({ where: { schoolId }, data: { planId } });
}

/// For a school that predates a plan existing, or was otherwise never
/// enrolled — createSchoolWithOwner enrolls every new signup automatically,
/// but a Super Admin still needs a way to onboard an existing school with
/// none rather than that being a permanent dead end in the UI.
export async function createSubscriptionForSchool(schoolId: string, planId: string) {
  const existing = await prisma.subscription.findUnique({ where: { schoolId } });
  if (existing) throw new Error("This school already has a subscription.");

  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + 30);
  return prisma.subscription.create({
    data: { schoolId, planId, status: "TRIALING", currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
  });
}

export async function updateSubscriptionStatus(schoolId: string, status: SubscriptionStatus) {
  const subscription = await prisma.subscription.findUnique({ where: { schoolId } });
  if (!subscription) throw new Error("This school has no subscription.");
  return prisma.subscription.update({
    where: { schoolId },
    data: { status, canceledAt: status === "CANCELED" ? new Date() : null },
  });
}

/// One invoice per subscription's current period — regenerating while the
/// latest invoice for this period is still PENDING/OVERDUE just returns it
/// rather than creating a duplicate.
export async function generatePlatformInvoice(schoolId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { schoolId }, include: { plan: true } });
  if (!subscription) throw new Error("This school has no subscription.");

  const existing = await prisma.platformInvoice.findFirst({
    where: { schoolId, subscriptionId: subscription.id, periodStart: subscription.currentPeriodStart, status: { in: ["PENDING", "OVERDUE"] } },
  });
  if (existing) return existing;

  return prisma.platformInvoice.create({
    data: {
      schoolId,
      subscriptionId: subscription.id,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      amountMinor: subscription.plan.priceMinor,
      dueDate: subscription.currentPeriodEnd,
    },
  });
}

export async function markPlatformInvoicePaid(invoiceId: string, markedPaidById: string) {
  const invoice = await prisma.platformInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status === "PAID") throw new Error("This invoice is already paid.");
  return prisma.platformInvoice.update({
    where: { id: invoiceId },
    data: { status: "PAID", paidAt: new Date(), markedPaidById },
  });
}

export async function voidPlatformInvoice(invoiceId: string) {
  const invoice = await prisma.platformInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status === "PAID") throw new Error("A paid invoice can't be voided.");
  return prisma.platformInvoice.update({ where: { id: invoiceId }, data: { status: "VOID" } });
}

export async function listPlans() {
  return prisma.subscriptionPlan.findMany({ orderBy: { priceMinor: "asc" } });
}

export interface PlanInput {
  name: string;
  priceMinor: number;
  billingInterval: BillingInterval;
  studentLimit?: number | null;
}

export async function createPlan(input: PlanInput) {
  return prisma.subscriptionPlan.create({ data: input });
}

/// Existing subscriptions keep referencing this plan by id, and past
/// PlatformInvoice rows already snapshotted their own amountMinor at
/// generation time (the same pattern payroll uses for payslips) — so
/// editing a plan only ever changes what happens going forward, never
/// rewrites history.
export async function updatePlan(planId: string, input: PlanInput) {
  return prisma.subscriptionPlan.update({ where: { id: planId }, data: input });
}

export async function setPlanActive(planId: string, isActive: boolean) {
  return prisma.subscriptionPlan.update({ where: { id: planId }, data: { isActive } });
}

export type { PlatformInvoiceStatus };
