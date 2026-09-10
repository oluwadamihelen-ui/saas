"use client";

import { useActionState } from "react";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addGuardianAction, type AddGuardianState } from "../actions";

export function AddGuardianForm({ studentId }: { studentId: string }) {
  const action = addGuardianAction.bind(null, studentId);
  const [state, formAction, isPending] = useActionState(action, { status: "idle" } as AddGuardianState);

  return (
    <form action={formAction} className="space-y-3 rounded-md border border-dashed border-border p-4">
      <p className="text-sm font-medium text-foreground">Add a guardian</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" name="firstName" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" name="lastName" required />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="relationship">Relationship</Label>
          <Select id="relationship" name="relationship" required defaultValue="">
            <option value="" disabled>Select</option>
            <option value="FATHER">Father</option>
            <option value="MOTHER">Mother</option>
            <option value="GUARDIAN">Guardian</option>
            <option value="OTHER">Other</option>
          </Select>
        </div>
      </div>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Adding..." : "Add guardian"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
