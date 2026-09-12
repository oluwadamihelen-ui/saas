import { requireSuperAdmin } from "@/lib/auth/require";
import { getCostCalculatorData } from "@/lib/services/platform";
import { CostCalculator } from "@/components/platform/cost-calculator";

export default async function PlatformCostsPage() {
  await requireSuperAdmin();
  const plans = await getCostCalculatorData();
  const currency = plans[0]?.currency ?? "NGN";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Unit economics</h1>
        <p className="text-sm text-muted">
          Project revenue, hosting cost, and margin at different school counts — starting from today&apos;s real numbers.
        </p>
      </div>

      <CostCalculator plans={plans} currency={currency} />
    </div>
  );
}
