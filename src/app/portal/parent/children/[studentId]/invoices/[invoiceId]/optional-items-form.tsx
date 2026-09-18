"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { updateInvoiceSelectionsAction, type PortalSelectionFormState } from "./actions";

import { useActionToast } from "@/hooks/use-action-toast";

const initialState: PortalSelectionFormState = { status: "idle" };

export function OptionalItemsForm({
  studentId,
  invoiceId,
  items,
  currency,
}: {
  studentId: string;
  invoiceId: string;
  items: { id: string; description: string; amountMinor: number; isIncluded: boolean }[];
  currency: string;
}) {
  const action = updateInvoiceSelectionsAction.bind(null, studentId, invoiceId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  useActionToast(state);

  return (
    <form action={formAction} className="space-y-3 border-t border-border p-4">
      <p className="text-sm font-medium text-foreground">Optional items</p>
      <p className="text-xs text-muted">Untick anything your child won&apos;t be using this term.</p>
      <div className="space-y-2">
        {items.map((item) => (
          <label key={item.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2">
              <input type="checkbox" name={`item-${item.id}`} defaultChecked={item.isIncluded} className="h-4 w-4 rounded border-border" />
              {item.description}
            </span>
            <span className="text-muted">{formatMoney(item.amountMinor, currency)}</span>
          </label>
        ))}
      </div>
      <Button type="submit" size="sm" variant="secondary" disabled={isPending}>{isPending ? "Saving..." : "Save selections"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
