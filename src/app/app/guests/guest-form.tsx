"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { GuestFormState } from "./actions";

const initialState: GuestFormState = { status: "idle" };

export function GuestForm({
  action,
  submitLabel,
  defaultValues,
}: {
  action: (prev: GuestFormState, formData: FormData) => Promise<GuestFormState>;
  submitLabel: string;
  defaultValues?: Record<string, string>;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.status === "success" && state.guestId) router.push(`/app/guests/${state.guestId}`);
  }, [state.status, state.guestId, router]);

  const d = defaultValues ?? {};

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="firstName">First name</Label>
        <Input id="firstName" name="firstName" required defaultValue={d.firstName} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lastName">Last name</Label>
        <Input id="lastName" name="lastName" required defaultValue={d.lastName} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone number</Label>
        <Input id="phone" name="phone" defaultValue={d.phone} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" defaultValue={d.email} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="address">Address</Label>
        <Input id="address" name="address" defaultValue={d.address} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nationality">Nationality</Label>
        <Input id="nationality" name="nationality" defaultValue={d.nationality} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dateOfBirth">Date of birth</Label>
        <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={d.dateOfBirth} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="idType">ID type</Label>
        <Input id="idType" name="idType" placeholder="Passport, Driver's License..." defaultValue={d.idType} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="idNumber">ID number</Label>
        <Input id="idNumber" name="idNumber" defaultValue={d.idNumber} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="emergencyContactName">Emergency contact name</Label>
        <Input id="emergencyContactName" name="emergencyContactName" defaultValue={d.emergencyContactName} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="emergencyContactPhone">Emergency contact phone</Label>
        <Input id="emergencyContactPhone" name="emergencyContactPhone" defaultValue={d.emergencyContactPhone} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="preferences">Preferences</Label>
        <Textarea id="preferences" name="preferences" placeholder="Non-smoking room, high floor..." defaultValue={d.preferences} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" defaultValue={d.notes} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : submitLabel}
        </Button>
        {state.status === "error" && <span className="ml-3 text-sm text-danger">{state.message}</span>}
      </div>
    </form>
  );
}
