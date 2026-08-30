"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlanKey } from "@/lib/plans";

export function PlanPicker({
  businessId,
  plans,
  currentPlanKey,
}: {
  businessId: string;
  plans: Array<{ key: PlanKey; name: string; priceMonthly: number; features: string[] }>;
  currentPlanKey: PlanKey;
}) {
  const router = useRouter();
  const [changing, setChanging] = useState<PlanKey | null>(null);

  async function changePlan(planKey: PlanKey) {
    setChanging(planKey);
    try {
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, planKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not change plan");
        return;
      }
      toast.success(`Switched to the ${data.subscription.plan.name} plan`);
      router.refresh();
    } finally {
      setChanging(null);
    }
  }

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-3">
      {plans.map((p) => {
        const active = p.key === currentPlanKey;
        return (
          <div key={p.key} className={cn("rounded-lg border p-4", active ? "border-primary bg-primary/5" : "border-border")}>
            <p className="font-semibold">{p.name}</p>
            <p className="mt-1 text-lg font-bold">
              {p.priceMonthly === 0 ? "Free" : `₦${p.priceMonthly.toLocaleString()}/mo`}
            </p>
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              {p.features.slice(0, 3).map((f) => (
                <li key={f} className="flex gap-1.5">
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" /> {f}
                </li>
              ))}
            </ul>
            <Button
              size="sm"
              variant={active ? "outline" : "default"}
              className="mt-4 w-full"
              disabled={active || changing === p.key}
              onClick={() => changePlan(p.key)}
            >
              {active ? "Current plan" : changing === p.key ? "Switching…" : "Switch"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
