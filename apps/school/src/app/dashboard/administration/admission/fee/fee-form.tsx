"use client";

import { useActionState } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { setAdmissionFeeAction, type AdmissionFeeFormState } from "./actions";

const initialState: AdmissionFeeFormState = { status: "idle" };

export function AdmissionFeeForm({ currentAmount, currency }: { currentAmount: number | null; currency: string }) {
  const [state, formAction, isPending] = useActionState(setAdmissionFeeAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="max-w-xs space-y-1.5">
        <Label htmlFor="amount">Admission fee ({currency})</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          min="0"
          step="0.01"
          defaultValue={currentAmount != null ? currentAmount / 100 : ""}
          placeholder="Leave blank to charge no fee"
        />
        <p className="text-xs text-muted">
          Charged to applicants on the public application form. Leave blank if admission applications are free.
        </p>
      </div>
      <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save fee"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
      {state.status === "success" && <p className="text-sm text-success">{state.message}</p>}
    </form>
  );
}
