"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { submitReset, type ResetPasswordState } from "./actions";

const initialState: ResetPasswordState = { status: "idle" };

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(submitReset, initialState);

  if (state.status === "success") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-success">{state.message}</p>
        <Link href="/login" className="block text-center text-sm font-medium text-accent">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" required minLength={8} placeholder="At least 8 characters" />
      </div>
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Resetting..." : "Reset password"}
      </Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
