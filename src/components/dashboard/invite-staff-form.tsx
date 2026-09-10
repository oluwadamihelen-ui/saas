"use client";

import { useActionState, useEffect, useRef } from "react";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface InviteStaffState {
  status: "idle" | "error" | "success";
  message?: string;
}

const initialState: InviteStaffState = { status: "idle" };

export function InviteStaffForm({
  roles,
  action,
}: {
  roles: { id: string; name: string }[];
  action: (prevState: InviteStaffState, formData: FormData) => Promise<InviteStaffState>;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="flex items-end gap-3">
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required placeholder="teacher@school.edu" />
      </div>
      <div className="w-48 space-y-1.5">
        <Label htmlFor="roleId">Role</Label>
        <Select id="roleId" name="roleId" required defaultValue="">
          <option value="" disabled>Select role</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </Select>
      </div>
      <Button type="submit" disabled={isPending}>{isPending ? "Sending..." : "Invite"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
