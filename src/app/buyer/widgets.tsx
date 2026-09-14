"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import { payBuyerInvoiceAction, type BuyerFormState } from "./actions";

const initialState: BuyerFormState = { status: "idle" };

export function PayBuyerInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const action = payBuyerInvoiceAction.bind(null, invoiceId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  useActionToast(state);

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Starting..." : "Pay now"}
      </Button>
      {state.status === "error" && <p className="text-xs text-danger">{state.message}</p>}
    </form>
  );
}
