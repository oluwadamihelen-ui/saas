"use client";

import { useActionState } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateProfileAction, changePasswordAction, type AccountFormState } from "@/lib/actions/account";

const initial: AccountFormState = { status: "idle" };

export function UpdateProfileForm({ name, phone }: { name: string; phone: string }) {
  const [state, formAction, isPending] = useActionState(updateProfileAction, initial);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" required defaultValue={name} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone number</Label>
        <Input id="phone" name="phone" defaultValue={phone} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
        {state.status !== "idle" && (
          <span className={`ml-3 text-sm ${state.status === "success" ? "text-success" : "text-danger"}`}>{state.message}</span>
        )}
      </div>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, formAction, isPending] = useActionState(changePasswordAction, initial);

  return (
    <form action={formAction} key={state.status === "success" ? "reset" : "form"} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input id="currentPassword" name="currentPassword" type="password" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="newPassword">New password</Label>
        <Input id="newPassword" name="newPassword" type="password" minLength={8} required placeholder="At least 8 characters" />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Updating..." : "Update Password"}
        </Button>
        {state.status !== "idle" && (
          <span className={`ml-3 text-sm ${state.status === "success" ? "text-success" : "text-danger"}`}>{state.message}</span>
        )}
      </div>
    </form>
  );
}
