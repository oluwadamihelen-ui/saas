import "server-only";
import { prisma } from "@/lib/db";

export async function getAdminOverviewMetrics() {
  const [
    revenueAgg,
    orderCount,
    customerCount,
    licensesSold,
    activeDeployments,
    activeDomains,
    activeHosting,
    pendingDeployments,
    failedDeployments,
    openTickets,
    mrrAgg,
  ] = await Promise.all([
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "PAID" } }),
    prisma.order.count(),
    prisma.user.count({ where: { role: { key: "CUSTOMER" } } }),
    prisma.applicationLicense.count(),
    prisma.deployment.count({ where: { status: { notIn: ["FAILED"] } } }),
    prisma.domain.count({ where: { status: "ACTIVE" } }),
    prisma.hostingAccount.count({ where: { status: "ACTIVE" } }),
    prisma.deployment.count({ where: { status: { in: ["QUEUED", "PREPARING", "CONNECTING", "INSTALLING", "CONFIGURING", "DNS_SETUP", "SSL_SETUP", "TESTING"] } } }),
    prisma.deployment.count({ where: { status: "FAILED" } }),
    prisma.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_FOR_CUSTOMER"] } } }),
    prisma.subscription.aggregate({ _sum: { amount: true }, where: { status: "ACTIVE", billingCycle: "MONTHLY" } }),
  ]);

  const revenue = Number(revenueAgg._sum.amount ?? 0);
  const mrr = Number(mrrAgg._sum.amount ?? 0);

  return {
    revenue,
    orderCount,
    customerCount,
    licensesSold,
    activeDeployments,
    activeDomains,
    activeHosting,
    pendingDeployments,
    failedDeployments,
    openTickets,
    mrr,
    arr: mrr * 12,
  };
}

export async function getRevenueOverTime(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const payments = await prisma.payment.findMany({
    where: { status: "PAID", createdAt: { gte: since } },
    select: { amount: true, createdAt: true },
  });

  const byDay = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const p of payments) {
    const key = p.createdAt.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + Number(p.amount));
  }
  return Array.from(byDay.entries()).map(([date, amount]) => ({ date, amount }));
}

export async function getPopularApplications(take = 6) {
  const grouped = await prisma.orderItem.groupBy({
    by: ["applicationId"],
    where: { type: "APPLICATION_LICENSE", applicationId: { not: null } },
    _count: { applicationId: true },
    orderBy: { _count: { applicationId: "desc" } },
    take,
  });

  const apps = await prisma.application.findMany({ where: { id: { in: grouped.map((g) => g.applicationId!) } } });
  const appMap = new Map(apps.map((a) => [a.id, a]));

  return grouped.map((g) => ({ name: appMap.get(g.applicationId!)?.name ?? "Unknown", sales: g._count.applicationId }));
}
