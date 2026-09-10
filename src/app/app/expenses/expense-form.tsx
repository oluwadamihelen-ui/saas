"use client";

import { useActionState, useEffect, useRef } from "react";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createExpenseAction, type ExpenseFormState } from "./actions";
import type { ExpenseCategory } from "@/generated/prisma/enums";

const CATEGORIES: ExpenseCategory[] = ["ELECTRICITY", "WATER", "STAFF_SALARY", "FOOD", "MAINTENANCE", "SUPPLIES", "INTERNET", "MARKETING", "OTHER"];
const initialState: ExpenseFormState = { status: "idle" };

export function ExpenseForm() {
  const [state, formAction, isPending] = useActionState(createExpenseAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <div className="space-y-1.5">
        <Label>Category</Label>
        <Select name="category" defaultValue="OTHER">
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Amount</Label>
        <Input name="amount" type="number" min={0} step="0.01" required />
      </div>
      <div className="space-y-1.5">
        <Label>Date</Label>
        <Input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
      </div>
      <div className="space-y-1.5">
        <Label>Vendor</Label>
        <Input name="vendor" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Description</Label>
        <Input name="description" />
      </div>
      <div className="sm:col-span-3 lg:col-span-6">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Record Expense"}
        </Button>
        {state.status === "error" && <span className="ml-3 text-sm text-danger">{state.message}</span>}
      </div>
    </form>
  );
}
