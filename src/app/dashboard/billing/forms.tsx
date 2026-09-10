"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { annualSavingsMinor } from "@/lib/billing/plan-catalog";
import { changePlanAction, cancelSubscriptionAction, reactivateSubscriptionAction, payInvoiceAction, type BillingFormState } from "./actions";

const initialState: BillingFormState = { status: "idle" };

export interface BillingPlanBrief {
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
}

export function PlanPicker({ plans, currentPlanId, currentInterval }: { plans: BillingPlanBrief[]; currentPlanId: string; currentInterval: "MONTHLY" | "YEARLY" }) {
  const [interval, setInterval] = useState<"MONTHLY" | "YEARLY">(currentInterval);
  const [state, formAction] = useActionState(changePlanAction, initialState);

  return (
    <div className="space-y-4">
      <div className="inline-flex items-center rounded-md border border-border p-0.5 text-sm">
        <button
          type="button"
          onClick={() => setInterval("MONTHLY")}
          className={`rounded px-3 py-1.5 ${interval === "MONTHLY" ? "bg-accent text-accent-foreground" : "text-muted"}`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setInterval("YEARLY")}
          className={`rounded px-3 py-1.5 ${interval === "YEARLY" ? "bg-accent text-accent-foreground" : "text-muted"}`}
        >
          Annual
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId && interval === currentInterval;
          const priceMinor = interval === "YEARLY" ? plan.priceAnnualMinor : plan.priceMonthlyMinor;
          const savings = interval === "YEARLY" ? annualSavingsMinor(plan) : null;

          return (
            <div
              key={plan.id}
              className={`flex flex-col gap-3 rounded-lg border p-4 ${plan.isMostPopular ? "border-accent" : "border-border"}`}
            >
              <div>
                <p className="flex items-center gap-2 font-medium text-foreground">
                  {plan.name}
                  {plan.isMostPopular && <Badge variant="accent">Most popular</Badge>}
                  {isCurrent && <Badge variant="success">Current</Badge>}
                </p>
                {plan.tagline && <p className="text-xs text-muted">{plan.tagline}</p>}
              </div>

              <p className="text-lg font-semibold text-foreground">
                {plan.isCustomPricing ? "Custom" : formatMoney(priceMinor ?? 0, plan.currency)}
                {!plan.isCustomPricing && <span className="text-sm font-normal text-muted">/{interval === "YEARLY" ? "yr" : "mo"}</span>}
              </p>
              {savings != null && savings > 0 && <p className="text-xs text-success">Save {formatMoney(savings, plan.currency)}/yr</p>}

              <p className="text-xs text-muted">{plan.studentLimit ? `Up to ${plan.studentLimit} students` : "Unlimited students"}</p>

              <form action={formAction} className="mt-auto">
                <input type="hidden" name="planId" value={plan.id} />
                <input type="hidden" name="billingInterval" value={interval} />
                <Button type="submit" size="sm" variant={isCurrent ? "secondary" : "primary"} disabled={isCurrent || plan.isCustomPricing} className="w-full">
                  {plan.isCustomPricing ? "Contact sales" : isCurrent ? "Current plan" : "Switch to this plan"}
                </Button>
              </form>
            </div>
          );
        })}
      </div>

      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </div>
  );
}

export function CancelSubscriptionForm() {
  const [state, formAction, isPending] = useActionState(cancelSubscriptionAction, initialState);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" size="sm" variant="destructive" onClick={() => setConfirming(true)}>
        Cancel subscription
      </Button>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <p className="text-sm text-foreground">
        Your school will lose access to paid features at the end of the current billing period. Your data is never deleted.
      </p>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" variant="destructive" disabled={isPending}>
          {isPending ? "Cancelling..." : "Confirm cancellation"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)}>
          Keep subscription
        </Button>
      </div>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function ReactivateSubscriptionForm({ defaultInterval }: { defaultInterval: "MONTHLY" | "YEARLY" }) {
  const [state, formAction, isPending] = useActionState(reactivateSubscriptionAction, initialState);

  return (
    <form action={formAction} className="flex items-center gap-3">
      <input type="hidden" name="billingInterval" value={defaultInterval} />
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Renewing..." : "Renew subscription"}
      </Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function PayInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const action = payInvoiceAction.bind(null, invoiceId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Starting..." : "Pay now"}
      </Button>
      {state.status === "error" && <p className="text-xs text-danger">{state.message}</p>}
    </form>
  );
}
