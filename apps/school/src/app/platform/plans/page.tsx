import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSuperAdmin } from "@/lib/auth/require";
import { listPlans } from "@/lib/services/platform";
import { CreatePlanForm, PlanRow } from "./forms";

export default async function PlatformPlansPage() {
  await requireSuperAdmin();
  const plans = await listPlans();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Subscription plans</h1>
        <p className="text-sm text-muted">{plans.length} plan{plans.length === 1 ? "" : "s"}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create a plan</CardTitle>
          <CardDescription>Deactivating a plan hides it from new signups — schools already on it are unaffected.</CardDescription>
        </CardHeader>
        <CardContent><CreatePlanForm /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Plans</CardTitle></CardHeader>
        <CardContent className="p-0">
          {plans.length === 0 ? (
            <EmptyState title="No plans yet" className="p-8" />
          ) : (
            <ul className="divide-y divide-border">
              {plans.map((p) => (
                <PlanRow key={p.id} plan={p} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
