"use client";

import { useActionState, useEffect, useRef } from "react";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createVendorAction, createExpenseCategoryAction, recordExpenseAction, type FinanceFormState } from "./actions";

const initialState: FinanceFormState = { status: "idle" };

export function VendorForm() {
  const [state, formAction, isPending] = useActionState(createVendorAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === "success") formRef.current?.reset(); }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="flex items-end gap-3">
      <div className="w-48 space-y-1.5">
        <Label htmlFor="vendorName">Vendor</Label>
        <Input id="vendorName" name="name" required placeholder="ABC Suppliers" />
      </div>
      <div className="w-56 space-y-1.5">
        <Label htmlFor="contactInfo">Contact (optional)</Label>
        <Input id="contactInfo" name="contactInfo" placeholder="Phone or email" />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Adding..." : "Add vendor"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function ExpenseCategoryForm() {
  const [state, formAction, isPending] = useActionState(createExpenseCategoryAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === "success") formRef.current?.reset(); }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="flex items-end gap-3">
      <div className="w-56 space-y-1.5">
        <Label htmlFor="categoryName">Category</Label>
        <Input id="categoryName" name="name" required placeholder="Fuel" />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Adding..." : "Add category"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function RecordExpenseForm({
  categories,
  vendors,
}: {
  categories: { id: string; name: string }[];
  vendors: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(recordExpenseAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === "success") formRef.current?.reset(); }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4 rounded-md border border-dashed border-border p-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="categoryId">Category</Label>
          <Select id="categoryId" name="categoryId" required defaultValue="">
            <option value="" disabled>Select category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vendorId">Vendor (optional)</Label>
          <Select id="vendorId" name="vendorId" defaultValue="">
            <option value="">No vendor</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="amount">Amount</Label>
          <Input id="amount" name="amount" type="number" min={0} step="0.01" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="incurredAt">Date</Label>
          <Input id="incurredAt" name="incurredAt" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" required placeholder="What was this for?" />
      </div>
      <Button type="submit" disabled={isPending}>{isPending ? "Recording..." : "Record expense"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
