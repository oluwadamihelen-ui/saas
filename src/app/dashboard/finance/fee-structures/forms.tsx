"use client";

import { useActionState, useEffect, useRef } from "react";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createFeeCategoryAction, createFeeStructureAction, type FinanceFormState } from "./actions";

const initialState: FinanceFormState = { status: "idle" };

export function FeeCategoryForm() {
  const [state, formAction, isPending] = useActionState(createFeeCategoryAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="flex items-end gap-3">
      <div className="w-56 space-y-1.5">
        <Label htmlFor="name">New category</Label>
        <Input id="name" name="name" required placeholder="Sports Levy" />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Adding..." : "Add"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function FeeStructureForm({
  categories,
  classGroups,
  terms,
}: {
  categories: { id: string; name: string }[];
  classGroups: { id: string; name: string }[];
  terms: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(createFeeStructureAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-4">
      <div className="w-48 space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required placeholder="Tuition - Term" />
      </div>
      <div className="w-40 space-y-1.5">
        <Label htmlFor="categoryId">Category</Label>
        <Select id="categoryId" name="categoryId" required defaultValue="">
          <option value="" disabled>Select</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>
      <div className="w-44 space-y-1.5">
        <Label htmlFor="classGroupId">Class</Label>
        <Select id="classGroupId" name="classGroupId" defaultValue="">
          <option value="">All classes</option>
          {classGroups.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>
      <div className="w-44 space-y-1.5">
        <Label htmlFor="termId">Term</Label>
        <Select id="termId" name="termId" required defaultValue="">
          <option value="" disabled>Select</option>
          {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      </div>
      <div className="w-36 space-y-1.5">
        <Label htmlFor="amount">Amount</Label>
        <Input id="amount" name="amount" type="number" min={0} step="0.01" required />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Adding..." : "Add"}</Button>
      {state.status === "error" && <p className="w-full text-sm text-danger">{state.message}</p>}
    </form>
  );
}
