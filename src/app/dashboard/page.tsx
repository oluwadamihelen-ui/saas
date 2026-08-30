import Link from "next/link";
import { Sparkles, ArrowRight, ShoppingBag, Users, Wallet, TrendingUp } from "lucide-react";
import { getCurrentBusiness } from "@/lib/current-business";
import { getDashboardMetrics } from "@/lib/analytics/queries";
import { generateDashboardInsights } from "@/lib/analytics/insights";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardHome() {
  const current = await getCurrentBusiness();
  if (!current) return null;
  const { business } = current;

  const [metrics, insights] = await Promise.all([
    getDashboardMetrics(business.id),
    generateDashboardInsights(business.id, business.currency),
  ]);

  const stats = [
    { label: "Today's Sales", value: formatCurrency(metrics.todaysSales, business.currency), icon: Wallet },
    { label: "Orders", value: String(metrics.todaysOrders), icon: ShoppingBag },
    { label: "Customers", value: String(metrics.totalCustomers), icon: Users },
    { label: "Average Order Value", value: formatCurrency(metrics.avgOrderValue, business.currency), icon: TrendingUp },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting()}, {business.ownerName.split(" ")[0]} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Here&apos;s how {business.name} is doing.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                <s.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-primary">Mama AI insight</p>
              <div className="mt-1 space-y-1.5 text-sm">
                {insights.map((i, idx) => (
                  <p key={idx}>{i}</p>
                ))}
              </div>
              <Button asChild size="sm" className="mt-4">
                <Link href="/dashboard/ai">
                  Ask Mama <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <QuickLink href="/dashboard/orders" title="Orders" description="View and manage every order." />
        <QuickLink href="/dashboard/products" title="Products" description="Add or update your catalog." />
        <QuickLink href="/dashboard/customers" title="Customers" description="See who's buying from you." />
        <QuickLink href="/dashboard/analytics" title="Analytics" description="Dig into your sales trends." />
      </div>
    </div>
  );
}

function QuickLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href}>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-center justify-between pt-6">
          <div>
            <p className="font-semibold">{title}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
