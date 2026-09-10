"use client";

import { useActionState, useEffect, useRef } from "react";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { recordPaymentAction, type PaymentFormState } from "./actions";

const initialState: PaymentFormState = { status: "idle" };

export function RecordPaymentForm({ invoiceId }: { invoiceId: string }) {
  const action = recordPaymentAction.bind(null, invoiceId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="w-36 space-y-1.5">
        <Label htmlFor="amount">Amount</Label>
        <Input id="amount" name="amount" type="number" min={0} step="0.01" required />
      </div>
      <div className="w-44 space-y-1.5">
        <Label htmlFor="method">Method</Label>
        <Select id="method" name="method" defaultValue="MANUAL">
          <option value="MANUAL">Cash / manual</option>
          <option value="BANK_TRANSFER">Bank transfer</option>
        </Select>
      </div>
      <div className="w-44 space-y-1.5">
        <Label htmlFor="reference">Reference (optional)</Label>
        <Input id="reference" name="reference" placeholder="Bank ref / receipt no." />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Recording..." : "Record payment"}</Button>
      {state.status === "error" && <p className="w-full text-sm text-danger">{state.message}</p>}
    </form>
  );
}
