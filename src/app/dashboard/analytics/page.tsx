import { getCurrentBusiness } from "@/lib/current-business";
import {
  getSalesSummary,
  getDailyRevenueSeries,
  getTopProducts,
  getSalesByCategory,
  getCustomerSegmentCounts,
  getRepeatPurchaseRate,
  daysAgo,
} from "@/lib/analytics/queries";
import { AnalyticsCharts } from "@/components/dashboard/analytics/analytics-charts";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const current = await getCurrentBusiness();
  if (!current) return null;
  const { business } = current;

  const { range } = await searchParams;
  const days = range === "30" ? 30 : range === "90" ? 90 : 7;
  const from = daysAgo(days);
  const to = new Date();

  const [summary, series, topProducts, categories, segments, repeatRate] = await Promise.all([
    getSalesSummary(business.id, from, to),
    getDailyRevenueSeries(business.id, from, to),
    getTopProducts(business.id, from, to, 8),
    getSalesByCategory(business.id, from, to),
    getCustomerSegmentCounts(business.id),
    getRepeatPurchaseRate(business.id, from, to),
  ]);

  const stats = [
    { label: "Revenue", value: formatCurrency(summary.revenue, business.currency) },
    { label: "Orders", value: formatNumber(summary.orderCount) },
    { label: "Avg. Order Value", value: formatCurrency(summary.avgOrderValue, business.currency) },
    { label: "Repeat Purchase Rate", value: `${Math.round(repeatRate * 100)}%` },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Understand what's driving your business.</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-1 text-sm">
          {[
            { label: "7 days", value: "7" },
            { label: "30 days", value: "30" },
            { label: "90 days", value: "90" },
          ].map((r) => (
            <a
              key={r.value}
              href={`?range=${r.value}`}
              className={`rounded-md px-3 py-1.5 font-medium ${days === Number(r.value) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
            >
              {r.label}
            </a>
          ))}
        </div>
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

      <AnalyticsCharts
        currency={business.currency}
        series={series}
        topProducts={topProducts}
        categories={categories}
        segments={segments}
      />
    </div>
  );
}
