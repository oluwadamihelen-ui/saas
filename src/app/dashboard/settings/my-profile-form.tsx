"use client";

import { useActionState } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { saveMyDateOfBirth, type MyProfileState } from "./profile-actions";

const initialState: MyProfileState = { status: "idle" };

/// dateOfBirth arrives already normalized to "YYYY-MM-DD" (or null) — see
/// the plain <input type="date"> value contract used the same way on the
/// student enrollment form.
export function MyProfileForm({ dateOfBirth }: { dateOfBirth: string | null }) {
  const [state, formAction, isPending] = useActionState(saveMyDateOfBirth, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="max-w-xs space-y-1.5">
        <Label htmlFor="dateOfBirth">Date of birth</Label>
        <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={dateOfBirth ?? ""} />
        <p className="text-xs text-muted">
          Only used to show you in Upcoming Birthdays — the day and month are shown, never the year. Leave blank to opt out.
        </p>
      </div>
      <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
      {state.status === "success" && <p className="text-sm text-success">{state.message}</p>}
    </form>
  );
}
