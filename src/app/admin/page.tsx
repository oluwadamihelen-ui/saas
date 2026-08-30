import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/tenant";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { daysAgo } from "@/lib/analytics/queries";

export default async function AdminOverviewPage() {
  await requireAdmin();

  const [totalBusinesses, newBusinesses30d, totalOrders, paidOrders, aiMessageCount, whatsappMessageCount, activeSubscriptions] =
    await Promise.all([
      prisma.business.count(),
      prisma.business.count({ where: { createdAt: { gte: daysAgo(30) } } }),
      prisma.order.count(),
      prisma.order.findMany({ where: { paymentStatus: "PAID" }, select: { total: true } }),
      prisma.aIMessage.count({ where: { role: "USER" } }),
      prisma.conversationMessage.count(),
      prisma.subscription.findMany({ include: { plan: true } }),
    ]);

  const gmv = paidOrders.reduce((s, o) => s + Number(o.total), 0);
  const mrr = activeSubscriptions
    .filter((s) => s.status === "ACTIVE")
    .reduce((s, sub) => s + Number(sub.plan.priceMonthly), 0);
  const activeBusinesses = await prisma.business.count({ where: { isSuspended: false } });

  const stats = [
    { label: "Total Businesses", value: formatNumber(totalBusinesses) },
    { label: "Active Businesses", value: formatNumber(activeBusinesses) },
    { label: "New (30 days)", value: formatNumber(newBusinesses30d) },
    { label: "Total Orders", value: formatNumber(totalOrders) },
    { label: "GMV", value: formatCurrency(gmv) },
    { label: "MRR", value: formatCurrency(mrr) },
    { label: "Mama AI Messages", value: formatNumber(aiMessageCount) },
    { label: "WhatsApp Messages", value: formatNumber(whatsappMessageCount) },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">Across all businesses on MAMA.</p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
              <p className="mt-2 text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
