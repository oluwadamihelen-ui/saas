"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createPlanAction, setPlanActiveAction, type PlatformFormState } from "../actions";

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
