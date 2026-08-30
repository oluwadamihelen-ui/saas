import { getCurrentBusiness } from "@/lib/current-business";
import { prisma } from "@/lib/prisma";
import { PLAN_DEFS } from "@/lib/plans";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BusinessSettingsForm } from "@/components/dashboard/settings/business-settings-form";
import { PlanPicker } from "@/components/dashboard/settings/plan-picker";

export default async function SettingsPage() {
  const current = await getCurrentBusiness();
  if (!current) return null;
  const { business, role } = current;

  const [settings, subscription] = await Promise.all([
    prisma.businessSettings.findUnique({ where: { businessId: business.id } }),
    prisma.subscription.findUnique({ where: { businessId: business.id }, include: { plan: true } }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your business and subscription.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold">Business details</h2>
          <BusinessSettingsForm
            businessId={business.id}
            initial={{
              name: business.name,
              timezone: settings?.timezone ?? "Africa/Lagos",
              lowStockAlertEmail: settings?.lowStockAlertEmail ?? true,
              storefrontEnabled: settings?.storefrontEnabled ?? true,
            }}
            readOnly={role === "STAFF"}
          />
          <p className="mt-4 text-xs text-muted-foreground">
            Storefront: <code>{process.env.NEXT_PUBLIC_APP_URL}/shop/{business.slug}</code>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Subscription</h2>
            <Badge>{subscription?.plan.name ?? "Free"} plan</Badge>
          </div>
          <PlanPicker businessId={business.id} plans={PLAN_DEFS} currentPlanKey={(subscription?.plan.key as never) ?? "FREE"} />
        </CardContent>
      </Card>
    </div>
  );
}
