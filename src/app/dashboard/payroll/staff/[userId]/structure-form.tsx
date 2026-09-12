"use client";

import { useActionState } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { saveStaffSalaryStructureAction, type PayrollFormState } from "../../actions";

const initialState: PayrollFormState = { status: "idle" };

export function StructureForm({
  userId,
  components,
  existingAmountsMinor,
}: {
  userId: string;
  components: { id: string; name: string; type: "EARNING" | "DEDUCTION" }[];
  existingAmountsMinor: Record<string, number>;
}) {
  const [state, formAction, isPending] = useActionState(saveStaffSalaryStructureAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="userId" value={userId} />
      <div className="divide-y divide-border rounded-md border border-border">
        {components.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-4 p-3">
            <div className="flex items-center gap-2">
              <Label htmlFor={`amount-${c.id}`} className="font-normal">{c.name}</Label>
              <Badge variant={c.type === "EARNING" ? "success" : "danger"}>{c.type === "EARNING" ? "Earning" : "Deduction"}</Badge>
            </div>
            <div className="w-36">
              <input type="hidden" name="componentId" value={c.id} />
              <Input
                id={`amount-${c.id}`}
                name="amount"
                type="number"
                min={0}
                step="0.01"
                defaultValue={existingAmountsMinor[c.id] ? existingAmountsMinor[c.id] / 100 : ""}
                placeholder="0.00"
              />
            </div>
          </div>
        ))}
      </div>
      <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save salary structure"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
      {state.status === "success" && <p className="text-sm text-success">Saved.</p>}
    </form>
  );
}
