"use client";

import { useActionState } from "react";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createStaffMember, type StaffFormState } from "./actions";
import { HOTEL_ROLE_KEYS, ROLE_LABELS } from "@/lib/auth/permissions";

const initial: StaffFormState = { status: "idle" };
const DEPARTMENTS = ["MANAGEMENT", "RECEPTION", "HOUSEKEEPING", "FINANCE", "MAINTENANCE", "SECURITY", "RESTAURANT"];

export function StaffForm() {
  const [state, formAction, isPending] = useActionState(createStaffMember, initial);
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-5">
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
      <div className="space-y-1.5">
        <Label htmlFor="role">Role</Label>
        <Select id="role" name="role" defaultValue="RECEPTIONIST">
          {HOTEL_ROLE_KEYS.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="department">Department</Label>
        <Select id="department" name="department" defaultValue="RECEPTION">
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {d.charAt(0) + d.slice(1).toLowerCase()}
            </option>
          ))}
        </Select>
      </div>
      <div className="sm:col-span-5">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating..." : "Add Staff Member"}
        </Button>
        {state.status !== "idle" && (
          <span className={`ml-3 text-sm ${state.status === "success" ? "text-success" : "text-danger"}`}>
            {state.status === "success" ? "Staff account created." : state.message}
          </span>
        )}
      </div>
    </form>
  );
}
