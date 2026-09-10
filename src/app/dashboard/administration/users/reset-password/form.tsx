"use client";

import { useActionState, useEffect, useRef } from "react";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { resetPasswordAction, type ResetPasswordState } from "../actions";

const initialState: ResetPasswordState = { status: "idle" };

export function ResetPasswordForm({ accounts }: { accounts: { id: string; name: string; email: string; role: { name: string } }[] }) {
  const [state, formAction, isPending] = useActionState(resetPasswordAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === "success") formRef.current?.reset(); }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="userId">User</Label>
        <Select id="userId" name="userId" required defaultValue="">
          <option value="" disabled>Select a user</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name} — {a.email} ({a.role.name})</option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" required minLength={8} placeholder="At least 8 characters" />
      </div>
      <Button type="submit" disabled={isPending}>{isPending ? "Resetting..." : "Reset password"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
      {state.status === "success" && <p className="text-sm text-success">{state.message}</p>}
    </form>
  );
}
