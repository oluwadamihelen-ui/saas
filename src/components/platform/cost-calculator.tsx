"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";

export interface CalculatorPlan {
  id: string;
  name: string;
  priceMonthlyMinor: number | null;
  priceAnnualMinor: number | null;
  currency: string;
  isCustomPricing: boolean;
  activeSchoolCount: number;
}

type BillingInterval = "MONTHLY" | "ANNUAL";

/// Recurring-revenue math is always normalized to a monthly figure (even
/// when the "Annual" toggle is selected) so it lines up with hosting
/// costs, which are inherently monthly — the same MRR-normalization
/// convention platform.ts's own getPlatformStats() uses for real
/// subscriptions, applied here to hypothetical ones.
function monthlyPriceMinor(plan: CalculatorPlan, interval: BillingInterval): number {
  if (interval === "ANNUAL" && plan.priceAnnualMinor !== null) return Math.round(plan.priceAnnualMinor / 12);
  return plan.priceMonthlyMinor ?? 0;
}

const DEFAULT_VERCEL_SEATS = 1;
const DEFAULT_VERCEL_USD_PER_SEAT = 20;
const DEFAULT_NEON_USD = 15;
const DEFAULT_MISC_USD = 2;
const DEFAULT_USD_TO_NGN = 1350;

export function CostCalculator({ plans, currency }: { plans: CalculatorPlan[]; currency: string }) {
  const [interval, setInterval] = useState<BillingInterval>("MONTHLY");
  const [schoolCounts, setSchoolCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(plans.map((p) => [p.id, p.activeSchoolCount]))
  );
  const [enterpriseMonthlyRevenueMinor, setEnterpriseMonthlyRevenueMinor] = useState(0);

  const [vercelSeats, setVercelSeats] = useState(DEFAULT_VERCEL_SEATS);
  const [vercelUsdPerSeat, setVercelUsdPerSeat] = useState(DEFAULT_VERCEL_USD_PER_SEAT);
  const [neonUsd, setNeonUsd] = useState(DEFAULT_NEON_USD);
  const [miscUsd, setMiscUsd] = useState(DEFAULT_MISC_USD);
  const [usdToNgn, setUsdToNgn] = useState(DEFAULT_USD_TO_NGN);

  const standardPlans = plans.filter((p) => !p.isCustomPricing);
  const enterprisePlan = plans.find((p) => p.isCustomPricing);

  const result = useMemo(() => {
    const perPlan = standardPlans.map((plan) => {
      const count = schoolCounts[plan.id] ?? 0;
      const monthlyEach = monthlyPriceMinor(plan, interval);
      return { plan, count, monthlyEach, revenueMinor: count * monthlyEach };
    });

    const enterpriseCount = enterprisePlan ? (schoolCounts[enterprisePlan.id] ?? 0) : 0;
    const enterpriseRevenueMinor = enterpriseCount * enterpriseMonthlyRevenueMinor;

    const totalSchools = perPlan.reduce((sum, p) => sum + p.count, 0) + enterpriseCount;
    const totalRevenueMinor = perPlan.reduce((sum, p) => sum + p.revenueMinor, 0) + enterpriseRevenueMinor;

    const hostingCostUsd = vercelSeats * vercelUsdPerSeat + neonUsd + miscUsd;
    const hostingCostMinor = Math.round(hostingCostUsd * usdToNgn * 100);

    const marginMinor = totalRevenueMinor - hostingCostMinor;
    const marginPercent = totalRevenueMinor > 0 ? Math.round((marginMinor / totalRevenueMinor) * 1000) / 10 : null;

    return { perPlan, enterpriseCount, enterpriseRevenueMinor, totalSchools, totalRevenueMinor, hostingCostUsd, hostingCostMinor, marginMinor, marginPercent };
  }, [standardPlans, schoolCounts, interval, enterprisePlan, enterpriseMonthlyRevenueMinor, vercelSeats, vercelUsdPerSeat, neonUsd, miscUsd, usdToNgn]);

  function resetAssumptions() {
    setVercelSeats(DEFAULT_VERCEL_SEATS);
    setVercelUsdPerSeat(DEFAULT_VERCEL_USD_PER_SEAT);
    setNeonUsd(DEFAULT_NEON_USD);
    setMiscUsd(DEFAULT_MISC_USD);
    setUsdToNgn(DEFAULT_USD_TO_NGN);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile label="Schools" value={String(result.totalSchools)} />
        <SummaryTile label="Monthly revenue" value={formatMoney(result.totalRevenueMinor, currency)} />
        <SummaryTile label="Monthly hosting cost" value={`${formatMoney(result.hostingCostMinor, currency)}`} hint={`≈ $${result.hostingCostUsd.toFixed(0)}`} />
        <SummaryTile
          label="Monthly margin"
          value={formatMoney(result.marginMinor, currency)}
          hint={result.marginPercent !== null ? `${result.marginPercent}% margin` : "No revenue yet"}
          tone={result.marginMinor >= 0 ? "positive" : "negative"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Schools per plan</CardTitle>
          <CardDescription>
            Pre-filled with today&apos;s actual paying schools — change the numbers to project a different mix.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">Billing interval:</span>
            <Button size="sm" variant={interval === "MONTHLY" ? "primary" : "outline"} onClick={() => setInterval("MONTHLY")}>
              Monthly
            </Button>
            <Button size="sm" variant={interval === "ANNUAL" ? "primary" : "outline"} onClick={() => setInterval("ANNUAL")}>
              Annual (shown as monthly-equivalent)
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.perPlan.map(({ plan, count, monthlyEach, revenueMinor }) => (
              <div key={plan.id} className="rounded-md border border-border p-3">
                <p className="text-sm font-medium text-foreground">{plan.name}</p>
                <p className="text-xs text-muted">{formatMoney(monthlyEach, plan.currency)}/mo each</p>
                <Label htmlFor={`count-${plan.id}`} className="mt-2 block text-xs text-muted">
                  Schools on this plan
                </Label>
                <Input
                  id={`count-${plan.id}`}
                  type="number"
                  min={0}
                  value={count}
                  onChange={(e) => setSchoolCounts((prev) => ({ ...prev, [plan.id]: Math.max(0, Number(e.target.value) || 0) }))}
                  className="mt-1"
                />
                <p className="mt-2 text-xs text-muted">Revenue: <span className="font-medium text-foreground">{formatMoney(revenueMinor, plan.currency)}/mo</span></p>
              </div>
            ))}

            {enterprisePlan && (
              <div className="rounded-md border border-dashed border-border p-3">
                <p className="text-sm font-medium text-foreground">{enterprisePlan.name}</p>
                <p className="text-xs text-muted">Custom pricing — no fixed price to pull from</p>
                <Label htmlFor="enterprise-count" className="mt-2 block text-xs text-muted">
                  Schools on this plan
                </Label>
                <Input
                  id="enterprise-count"
                  type="number"
                  min={0}
                  value={schoolCounts[enterprisePlan.id] ?? 0}
                  onChange={(e) => setSchoolCounts((prev) => ({ ...prev, [enterprisePlan.id]: Math.max(0, Number(e.target.value) || 0) }))}
                  className="mt-1"
                />
                <Label htmlFor="enterprise-price" className="mt-2 block text-xs text-muted">
                  Assumed revenue per school (₦/mo)
                </Label>
                <Input
                  id="enterprise-price"
                  type="number"
                  min={0}
                  value={enterpriseMonthlyRevenueMinor / 100}
                  onChange={(e) => setEnterpriseMonthlyRevenueMinor(Math.max(0, Number(e.target.value) || 0) * 100)}
                  className="mt-1"
                />
                <p className="mt-2 text-xs text-muted">
                  Revenue: <span className="font-medium text-foreground">{formatMoney(result.enterpriseRevenueMinor, currency)}/mo</span>
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Hosting cost assumptions</CardTitle>
            <CardDescription>
              Your own estimates, not fetched live — check current prices at vercel.com/pricing and neon.com/pricing before trusting these numbers for a real budget.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={resetAssumptions}>
            Reset to defaults
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Vercel Pro seats" value={vercelSeats} onChange={setVercelSeats} />
          <Field label="Vercel $/seat/mo" value={vercelUsdPerSeat} onChange={setVercelUsdPerSeat} />
          <Field label="Neon $/mo" value={neonUsd} onChange={setNeonUsd} />
          <Field label="Domain + misc $/mo" value={miscUsd} onChange={setMiscUsd} />
          <Field label="₦ per $1" value={usdToNgn} onChange={setUsdToNgn} />
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <Label className="block text-xs text-muted">{label}</Label>
      <Input type="number" min={0} value={value} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} className="mt-1" />
    </div>
  );
}

function SummaryTile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "positive" | "negative" }) {
  return (
    <Card>
      <CardContent className="space-y-1.5">
        <p className="text-sm text-muted">{label}</p>
        <p className={`break-words text-xl font-semibold tracking-tight sm:text-2xl ${tone === "negative" ? "text-danger" : tone === "positive" ? "text-success" : "text-foreground"}`}>
          {value}
        </p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </CardContent>
    </Card>
  );
}
