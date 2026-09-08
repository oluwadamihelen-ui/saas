"use client";

import { useActionState } from "react";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { generateInvoicesAction, type GenerateInvoicesState } from "./actions";

const initialState: GenerateInvoicesState = { status: "idle" };

export function GenerateInvoicesForm({
  classArms,
  terms,
}: {
  classArms: { id: string; name: string; classGroup: { name: string } }[];
  terms: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(generateInvoicesAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="w-56 space-y-1.5">
        <Label htmlFor="classArmId">Class</Label>
        <Select id="classArmId" name="classArmId" required defaultValue="">
          <option value="" disabled>Select class</option>
          {classArms.map((c) => <option key={c.id} value={c.id}>{c.classGroup.name} {c.name}</option>)}
        </Select>
      </div>
      <div className="w-56 space-y-1.5">
        <Label htmlFor="termId">Term</Label>
        <Select id="termId" name="termId" required defaultValue="">
          <option value="" disabled>Select term</option>
          {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      </div>
      <Button type="submit" disabled={isPending}>{isPending ? "Generating..." : "Generate invoices"}</Button>
      {state.status === "error" && <p className="w-full text-sm text-danger">{state.message}</p>}
      {state.status === "success" && <p className="w-full text-sm text-success">{state.message}</p>}
    </form>
  );
}
