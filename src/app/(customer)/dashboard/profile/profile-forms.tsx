"use client";

import { useActionState } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateProfile, updatePassword, type ProfileState } from "./actions";

const initial: ProfileState = { status: "idle" };

interface ProfileFormProps {
  name: string;
  phone: string;
  company: string;
  country: string;
  addressLine1: string;
  city: string;
  stateProvince: string;
  postalCode: string;
}

export function ProfileForm({ name, phone, company, country, addressLine1, city, stateProvince, postalCode }: ProfileFormProps) {
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
          <Input id="phone" name="phone" defaultValue={phone} placeholder="+234 801 234 5678" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="company">Company</Label>
          <Input id="company" name="company" defaultValue={company} />
        </div>
      </div>

      <div className="space-y-1.5 border-t border-border pt-4">
        <Label htmlFor="addressLine1">Street address</Label>
        <Input id="addressLine1" name="addressLine1" defaultValue={addressLine1} placeholder="123 Example Street" />
        <p className="text-xs text-muted">Used as your domain registration (WHOIS) contact when you register a domain.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" defaultValue={city} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stateProvince">State / Province</Label>
          <Input id="stateProvince" name="stateProvince" defaultValue={stateProvince} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="postalCode">Postal code</Label>
          <Input id="postalCode" name="postalCode" defaultValue={postalCode} />
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
