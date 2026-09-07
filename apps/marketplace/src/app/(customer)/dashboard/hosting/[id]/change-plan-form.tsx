"use client";

import { useActionState } from "react";
import { Select, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { changePlan, type HostingActionState } from "../actions";

const initial: HostingActionState = { status: "idle" };

export function ChangePlanForm({
  accountId,
  currentPlanId,
  plans,
}: {
  accountId: string;
  currentPlanId: string;
  plans: { id: string; name: string; priceMonthly: number }[];
}) {
  const [state, formAction, isPending] = useActionState(changePlan.bind(null, accountId), initial);

  return (
    <form action={formAction} className="flex items-end gap-2">
      <div className="flex-1 space-y-1">
        <Label htmlFor="newPlanId">Change plan</Label>
        <Select id="newPlanId" name="newPlanId" defaultValue="">
          <option value="" disabled>
            Select a plan
          </option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id} disabled={plan.id === currentPlanId}>
              {plan.name} — {formatCurrency(plan.priceMonthly)}/mo{plan.id === currentPlanId ? " (current)" : ""}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Applying..." : "Apply"}
      </Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
