"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { annualSavingsMinor } from "@/lib/billing/plan-catalog";
import { FEATURE_CATALOG, FEATURE_CATEGORIES } from "@/lib/billing/features";
import { EnterpriseInquiryForm } from "./enterprise-form";

export interface PublicPlan {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  priceMonthlyMinor: number | null;
  priceAnnualMinor: number | null;
  currency: string;
  isCustomPricing: boolean;
  studentLimit: number | null;
  isMostPopular: boolean;
  features: Record<string, boolean>;
}

export function PricingCards({ plans }: { plans: PublicPlan[] }) {
  const [interval, setInterval] = useState<"MONTHLY" | "YEARLY">("MONTHLY");

  return (
    <div className="space-y-10">
      <div className="flex justify-center">
        <div className="inline-flex items-center rounded-md border border-border p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setInterval("MONTHLY")}
            className={`rounded px-4 py-2 ${interval === "MONTHLY" ? "bg-accent text-accent-foreground" : "text-muted"}`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setInterval("YEARLY")}
            className={`rounded px-4 py-2 ${interval === "YEARLY" ? "bg-accent text-accent-foreground" : "text-muted"}`}
          >
            Annual <span className="text-xs opacity-80">(save up to 2 months)</span>
          </button>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const priceMinor = interval === "YEARLY" ? plan.priceAnnualMinor : plan.priceMonthlyMinor;
          const savings = interval === "YEARLY" ? annualSavingsMinor(plan) : null;

          return (
            <div
              key={plan.id}
              className={`flex flex-col gap-4 rounded-xl border p-6 ${plan.isMostPopular ? "border-accent shadow-sm" : "border-border"}`}
            >
              <div>
                <p className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  {plan.name}
                  {plan.isMostPopular && <Badge variant="accent">Most popular</Badge>}
                </p>
                {plan.tagline && <p className="mt-1 text-sm text-muted">{plan.tagline}</p>}
              </div>

              <div>
                <p className="text-3xl font-semibold text-foreground">
                  {plan.isCustomPricing ? "Custom" : formatMoney(priceMinor ?? 0, plan.currency)}
                  {!plan.isCustomPricing && <span className="text-base font-normal text-muted">/{interval === "YEARLY" ? "yr" : "mo"}</span>}
                </p>
                {savings != null && savings > 0 && <p className="mt-1 text-sm text-success">Save {formatMoney(savings, plan.currency)}/yr</p>}
              </div>

              <p className="text-sm text-muted">{plan.studentLimit ? `Up to ${plan.studentLimit} students` : "Unlimited students"}</p>

              {plan.isCustomPricing ? (
                <Button asChild variant="secondary" className="mt-auto">
                  <a href="#enterprise">Contact sales</a>
                </Button>
              ) : (
                <Button asChild className="mt-auto" variant={plan.isMostPopular ? "primary" : "secondary"}>
                  <Link href="/register">Get started</Link>
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <div id="enterprise" className="space-y-4 pt-6 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Running more than one school?</h2>
        <p className="mx-auto max-w-xl text-muted">
          Enterprise plans are built around your group&apos;s campuses, student count and required modules — talk to us and we&apos;ll put a plan together.
        </p>
        <div className="flex justify-center">
          <EnterpriseInquiryForm />
        </div>
      </div>

      <div className="space-y-4 pt-10">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground">Compare plans</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted-surface">
                <th className="p-3 text-left font-medium text-foreground">Feature</th>
                {plans.map((plan) => (
                  <th key={plan.id} className="p-3 text-center font-medium text-foreground">{plan.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_CATEGORIES.map((category) => {
                const categoryFeatures = FEATURE_CATALOG.filter((f) => f.category === category);
                if (categoryFeatures.length === 0) return null;
                return (
                  <Fragment key={category}>
                    <tr className="border-b border-border bg-muted-surface/60">
                      <td colSpan={plans.length + 1} className="p-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted">
                        {category}
                      </td>
                    </tr>
                    {categoryFeatures.map((f) => (
                      <tr key={f.key} className="border-b border-border last:border-0">
                        <td className="p-3 text-foreground">{f.label}</td>
                        {plans.map((plan) => (
                          <td key={plan.id} className="p-3 text-center">
                            {plan.features[f.key] ? (
                              <span className="text-success" aria-label="Included">&#10003;</span>
                            ) : (
                              <span className="text-muted" aria-label="Not included">&mdash;</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
