"use client";

import { useActionState } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateProfile, updatePassword, type ProfileState } from "./actions";

const initial: ProfileState = { status: "idle" };

export function ProfileForm({ name, phone, company, country }: { name: string; phone: string; company: string; country: string }) {
  const [state, formAction, isPending] = useActionState(updateProfile, initial);
  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" defaultValue={name} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={phone} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="company">Company</Label>
          <Input id="company" name="company" defaultValue={company} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="country">Country</Label>
        <Input id="country" name="country" defaultValue={country} />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save Changes"}
      </Button>
      {state.status !== "idle" && (
        <p className={state.status === "success" ? "text-sm text-success" : "text-sm text-danger"}>{state.message}</p>
      )}
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction, isPending] = useActionState(updatePassword, initial);
  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input id="currentPassword" name="currentPassword" type="password" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="newPassword">New password</Label>
        <Input id="newPassword" name="newPassword" type="password" required minLength={8} />
      </div>
      <Button type="submit" variant="secondary" disabled={isPending}>
        {isPending ? "Updating..." : "Update Password"}
      </Button>
      {state.status !== "idle" && (
        <p className={state.status === "success" ? "text-sm text-success" : "text-sm text-danger"}>{state.message}</p>
      )}
    </form>
  );
}
