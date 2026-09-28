"use client";

import { useActionState } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { resetStaffPasswordAction, type ResetPasswordState } from "./actions";

const initial: ResetPasswordState = { status: "idle" };

export function ResetPasswordControl({ memberId }: { memberId: string }) {
  const action = resetStaffPasswordAction.bind(null, memberId);
  const [state, formAction, isPending] = useActionState(action, initial);

  return (
    <form action={formAction} key={state.status === "success" ? "reset" : "form"} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="newPassword">New temporary password</Label>
        <Input id="newPassword" name="newPassword" type="password" minLength={8} required placeholder="At least 8 characters" className="w-56" />
      </div>
      <Button type="submit" variant="secondary" disabled={isPending}>
        {isPending ? "Resetting..." : "Reset Password"}
      </Button>
      {state.status !== "idle" && (
        <span className={`text-sm ${state.status === "success" ? "text-success" : "text-danger"}`}>{state.message}</span>
      )}
    </form>
  );
}
