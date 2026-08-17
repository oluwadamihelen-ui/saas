import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = { title: "Pricing" };

const PLAN_ORDER = ["FREE", "STARTER", "CREATOR", "PRO"] as const;

const PLAN_BLURB: Record<(typeof PLAN_ORDER)[number], string> = {
  FREE: "Try the full workflow with a handful of free credits.",
  STARTER: "For individual creators making videos regularly.",
  CREATOR: "For creators and small teams who publish often.",
  PRO: "For teams and agencies with commercial video needs.",
};

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight">Simple, credit-based pricing</h1>
        <p className="mt-4 text-muted-foreground">
          Every plan includes the full creation pipeline. Higher tiers unlock more monthly
          credits, longer videos, higher-resolution exports and priority generation.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Final prices are being finalized — join the waitlist to be notified at launch.
        </p>
      </div>

      <div className="mt-14 grid gap-6 lg:grid-cols-4">
        {PLAN_ORDER.map((id) => {
          const plan = PLANS[id];
          const featured = id === "CREATOR";
          return (
            <Card
              key={id}
              className={`flex flex-col p-6 ${featured ? "border-brand-400 ring-2 ring-brand-400" : ""}`}
            >
              {featured && (
                <span className="mb-3 inline-block w-fit rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-700">
                  Most popular
                </span>
              )}
              <h3 className="font-display text-lg font-bold">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{PLAN_BLURB[id]}</p>
              <p className="mt-5 font-display text-3xl font-bold">
                {id === "FREE" ? "$0" : "TBD"}
                {id !== "FREE" && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
              </p>
              <ul className="mt-6 flex-1 space-y-3 text-sm">
                <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-success" /> {plan.monthlyCredits} credits / month</li>
                <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-success" /> Up to {Math.round(plan.maxVideoLengthSeconds / 60)} min videos</li>
                <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-success" /> {plan.maxExportResolution.toUpperCase()} export</li>
                <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-success" /> {plan.availableStyles === "all" ? "All visual styles" : "Core visual styles"}</li>
                <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-success" /> {plan.storageGb} GB storage</li>
                {plan.priorityGeneration && <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-success" /> Priority generation</li>}
                {plan.commercialUsage && <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-success" /> Commercial usage rights</li>}
              </ul>
              <Button href="/signup" variant={featured ? "primary" : "secondary"} className="mt-6 w-full">
                {id === "FREE" ? "Start for free" : "Get started"}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
