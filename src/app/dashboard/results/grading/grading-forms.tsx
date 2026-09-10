"use client";

import { useActionState, useEffect, useRef } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createGradeBandAction, createComponentAction, type GradingConfigState } from "../actions";

const initialState: GradingConfigState = { status: "idle" };

export function GradeBandForm() {
  const [state, formAction, isPending] = useActionState(createGradeBandAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="w-20 space-y-1.5">
        <Label htmlFor="grade">Grade</Label>
        <Input id="grade" name="grade" required placeholder="A" />
      </div>
      <div className="w-24 space-y-1.5">
        <Label htmlFor="minScore">Min</Label>
        <Input id="minScore" name="minScore" type="number" min={0} max={100} required />
      </div>
      <div className="w-24 space-y-1.5">
        <Label htmlFor="maxScore">Max</Label>
        <Input id="maxScore" name="maxScore" type="number" min={0} max={100} required />
      </div>
      <div className="w-48 space-y-1.5">
        <Label htmlFor="remark">Remark</Label>
        <Input id="remark" name="remark" required placeholder="Excellent" />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Adding..." : "Add"}</Button>
      {state.status === "error" && <p className="w-full text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function ComponentForm() {
  const [state, formAction, isPending] = useActionState(createComponentAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="w-48 space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required placeholder="1st CA" />
      </div>
      <div className="w-32 space-y-1.5">
        <Label htmlFor="maxScore">Max score</Label>
        <Input id="maxScore" name="maxScore" type="number" min={1} required />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Adding..." : "Add"}</Button>
      {state.status === "error" && <p className="w-full text-sm text-danger">{state.message}</p>}
    </form>
  );
}
