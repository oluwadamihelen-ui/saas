"use client";

import { useActionState } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createStaffMember, type StaffFormState } from "./actions";

const initial: StaffFormState = { status: "idle" };

export function StaffForm() {
  const [state, formAction, isPending] = useActionState(createStaffMember, initial);
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Temporary password</Label>
        <Input id="password" name="password" type="password" minLength={8} required />
      </div>
      <div className="sm:col-span-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating..." : "Add Staff Member"}
        </Button>
        {state.status !== "idle" && (
          <span className={`ml-3 text-sm ${state.status === "success" ? "text-success" : "text-danger"}`}>{state.message}</span>
        )}
      </div>
    </form>
  );
}
