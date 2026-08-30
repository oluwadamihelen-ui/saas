import { getCurrentBusiness } from "@/lib/current-business";
import { prisma } from "@/lib/prisma";
import { getCustomerLifetimeValue, getCustomerSegmentCounts } from "@/lib/analytics/queries";
import { CustomersClient } from "@/components/dashboard/customers/customers-client";
import { Card, CardContent } from "@/components/ui/card";

export default async function CustomersPage() {
  const current = await getCurrentBusiness();
  if (!current) return null;
  const { business } = current;

  const [customers, segments] = await Promise.all([
    prisma.customer.findMany({ where: { businessId: business.id }, orderBy: { createdAt: "desc" } }),
    getCustomerSegmentCounts(business.id),
  ]);

  const withStats = await Promise.all(
    customers.map(async (c) => ({ ...c, stats: await getCustomerLifetimeValue(business.id, c.id) }))
  );

  const segmentStats = [
    { label: "VIP", value: segments.vip },
    { label: "Returning", value: segments.returning },
    { label: "New", value: segments.new },
    { label: "Inactive", value: segments.inactive },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your CRM, built automatically from every order.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {segmentStats.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
              <p className="mt-2 text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <CustomersClient currency={business.currency} customers={JSON.parse(JSON.stringify(withStats))} />
    </div>
  );
}
