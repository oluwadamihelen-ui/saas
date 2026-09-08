"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { createPlanAction, updatePlanAction, setPlanActiveAction, type PlatformFormState } from "../actions";

const initialState: PlatformFormState = { status: "idle" };

export function CreatePlanForm() {
  const [state, formAction, isPending] = useActionState(createPlanAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === "success") formRef.current?.reset(); }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Plan name</Label>
          <Input id="name" name="name" required placeholder="Growth" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="billingInterval">Billing interval</Label>
          <Select id="billingInterval" name="billingInterval" defaultValue="MONTHLY">
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="price">Price</Label>
          <Input id="price" name="price" type="number" min={0} step="0.01" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="studentLimit">Student limit (optional)</Label>
          <Input id="studentLimit" name="studentLimit" type="number" min={1} placeholder="Unlimited" />
        </div>
      </div>
      <Button type="submit" disabled={isPending}>{isPending ? "Creating..." : "Create plan"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export interface PlanBrief {
  id: string;
  name: string;
  priceMinor: number;
  billingInterval: "MONTHLY" | "YEARLY";
  studentLimit: number | null;
  isActive: boolean;
}

/// One row per plan — either the summary view (name/price, Edit and
/// Activate/Deactivate buttons) or, once Edit is clicked, the same
/// fields CreatePlanForm uses, pre-filled and wired to updatePlanAction
/// instead. Local isEditing state, so switching one row into edit mode
/// never touches the others.
export function PlanRow({ plan, currency }: { plan: PlanBrief; currency: string }) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return <EditPlanForm plan={plan} onDone={() => setIsEditing(false)} />;
  }

  return (
    <li className="flex items-center justify-between gap-3 p-4 text-sm">
      <div>
        <p className="flex items-center gap-2 font-medium text-foreground">
          {plan.name}
          {!plan.isActive && <Badge variant="neutral">Inactive</Badge>}
        </p>
        <p className="text-xs text-muted">
          {formatMoney(plan.priceMinor, currency)}/{plan.billingInterval === "MONTHLY" ? "mo" : "yr"} ·{" "}
          {plan.studentLimit ? `up to ${plan.studentLimit} students` : "unlimited students"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)}>Edit</Button>
        <PlanActiveToggle planId={plan.id} isActive={plan.isActive} />
      </div>
    </li>
  );
}

function EditPlanForm({ plan, onDone }: { plan: PlanBrief; onDone: () => void }) {
  const action = updatePlanAction.bind(null, plan.id);
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.status === "success") onDone();
    // onDone is a fresh closure each render (setIsEditing(false)) — only re-run when the save actually succeeds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  return (
    <li className="p-4 text-sm">
      <form action={formAction} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor={`name-${plan.id}`}>Plan name</Label>
            <Input id={`name-${plan.id}`} name="name" required defaultValue={plan.name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`billingInterval-${plan.id}`}>Billing interval</Label>
            <Select id={`billingInterval-${plan.id}`} name="billingInterval" defaultValue={plan.billingInterval}>
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor={`price-${plan.id}`}>Price</Label>
            <Input id={`price-${plan.id}`} name="price" type="number" min={0} step="0.01" required defaultValue={plan.priceMinor / 100} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`studentLimit-${plan.id}`}>Student limit (optional)</Label>
            <Input
              id={`studentLimit-${plan.id}`}
              name="studentLimit"
              type="number"
              min={1}
              placeholder="Unlimited"
              defaultValue={plan.studentLimit ?? ""}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Saving..." : "Save changes"}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
        </div>
        {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
      </form>
    </li>
  );
}

export function PlanActiveToggle({ planId, isActive }: { planId: string; isActive: boolean }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      size="sm"
      variant={isActive ? "ghost" : "secondary"}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await setPlanActiveAction(planId, !isActive);
          router.refresh();
        })
      }
    >
      {isActive ? "Deactivate" : "Activate"}
    </Button>
  );
}
