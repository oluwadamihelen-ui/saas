import type { Metadata } from "next";
import { Building2, Users, CalendarCheck, TrendingUp, AlertTriangle } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/require";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard, StatCardGrid } from "@/components/ui/stat-card";
import { getPlatformOverview } from "@/lib/services/hotels";

export const metadata: Metadata = { title: "Platform Overview" };

export default async function SuperAdminOverviewPage() {
  await requireSuperAdmin();
  const overview = await getPlatformOverview();

  const cards = [
    { label: "Total Hotels", value: overview.hotelCount, icon: Building2 },
    { label: "Active Hotels", value: overview.activeHotels, icon: TrendingUp },
    { label: "Trial Hotels", value: overview.trialHotels, icon: AlertTriangle },
    { label: "Suspended Hotels", value: overview.suspendedHotels, icon: AlertTriangle },
    { label: "Platform Users", value: overview.userCount, icon: Users },
    { label: "Total Reservations", value: overview.reservationCount, icon: CalendarCheck },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Platform Overview</h1>

      <StatCardGrid>
        {cards.map((c) => (
          <StatCard key={c.label} label={c.label} value={c.value} icon={c.icon} />
        ))}
      </StatCardGrid>

      <Card>
        <CardContent>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Hotels by subscription plan</h3>
          <ul className="space-y-1 text-sm">
            {overview.byPlan.map((p) => (
              <li key={p.subscriptionPlan} className="flex justify-between text-muted">
                <span>{p.subscriptionPlan}</span>
                <span className="text-foreground">{p._count}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
