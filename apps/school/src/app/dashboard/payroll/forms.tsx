"use client";

import { useActionState, useEffect, useRef } from "react";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createSalaryComponentAction, generatePayrollRunAction, type PayrollFormState } from "./actions";

const initialState: PayrollFormState = { status: "idle" };

export function SalaryComponentForm() {
  const [state, formAction, isPending] = useActionState(createSalaryComponentAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === "success") formRef.current?.reset(); }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="w-56 space-y-1.5">
        <Label htmlFor="componentName">Component</Label>
        <Input id="componentName" name="name" required placeholder="Housing Allowance" />
      </div>
      <div className="w-44 space-y-1.5">
        <Label htmlFor="componentType">Type</Label>
        <Select id="componentType" name="type" defaultValue="EARNING">
          <option value="EARNING">Earning</option>
          <option value="DEDUCTION">Deduction</option>
        </Select>
      </div>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Adding..." : "Add component"}</Button>
      {state.status === "error" && <p className="w-full text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function GeneratePayrollRunForm() {
  const [state, formAction, isPending] = useActionState(generatePayrollRunAction, initialState);
  const now = new Date();

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="w-40 space-y-1.5">
        <Label htmlFor="month">Month</Label>
        <Select id="month" name="month" defaultValue={String(now.getMonth() + 1)}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {new Date(2000, m - 1, 1).toLocaleString("en-US", { month: "long" })}
            </option>
          ))}
        </Select>
      </div>
      <div className="w-28 space-y-1.5">
        <Label htmlFor="year">Year</Label>
        <Input id="year" name="year" type="number" defaultValue={now.getFullYear()} required />
      </div>
      <Button type="submit" disabled={isPending}>{isPending ? "Generating..." : "Generate payroll run"}</Button>
      {state.status === "error" && <p className="w-full text-sm text-danger">{state.message}</p>}
      {state.status === "success" && <p className="w-full text-sm text-success">{state.message}</p>}
    </form>
  );
}
