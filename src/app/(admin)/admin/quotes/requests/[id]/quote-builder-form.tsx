"use client";

import * as React from "react";
import { useActionState } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createQuoteAdmin, type QuoteFormState } from "../../actions";

const initial: QuoteFormState = { status: "idle" };

interface Line {
  key: number;
  description: string;
  quantity: string;
  unitPrice: string;
}

export function QuoteBuilderForm({ requestId }: { requestId: string }) {
  const [state, formAction, isPending] = useActionState(createQuoteAdmin.bind(null, requestId), initial);
  const [lines, setLines] = React.useState<Line[]>([{ key: 0, description: "", quantity: "1", unitPrice: "" }]);
  const nextKey = React.useRef(1);

  const addLine = () => setLines((prev) => [...prev, { key: nextKey.current++, description: "", quantity: "1", unitPrice: "" }]);
  const removeLine = (key: number) => setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  const updateLine = (key: number, field: keyof Omit<Line, "key">, value: string) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));

  const total = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-3">
        {lines.map((line) => (
          <div key={line.key} className="grid grid-cols-[1fr_80px_120px_auto] items-end gap-2">
            <div className="space-y-1">
              <Label>Description</Label>
              <Input name="itemDescription" value={line.description} onChange={(e) => updateLine(line.key, "description", e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Qty</Label>
              <Input name="itemQuantity" type="number" min="1" value={line.quantity} onChange={(e) => updateLine(line.key, "quantity", e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Unit price</Label>
              <Input name="itemUnitPrice" type="number" min="0" step="0.01" value={line.unitPrice} onChange={(e) => updateLine(line.key, "unitPrice", e.target.value)} required />
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={() => removeLine(line.key)} disabled={lines.length === 1}>
              Remove
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" size="sm" variant="secondary" onClick={addLine}>
        Add line item
      </Button>

      <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="taxRate">Tax rate (0–1, e.g. 0.075 for 7.5%)</Label>
          <Input id="taxRate" name="taxRate" type="number" min="0" max="1" step="0.001" defaultValue="0" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="expiresInDays">Valid for (days)</Label>
          <Input id="expiresInDays" name="expiresInDays" type="number" min="1" defaultValue="14" />
        </div>
      </div>

      <p className="text-sm text-muted">
        Subtotal: <span className="font-semibold text-foreground">${total.toFixed(2)}</span>
      </p>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Sending..." : "Send Quote"}
      </Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
