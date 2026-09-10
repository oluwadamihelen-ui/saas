"use client";

import { useActionState } from "react";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { saveSchoolInfo, type SchoolInfoState } from "./actions";

const initialState: SchoolInfoState = { status: "idle" };

const CURRENCIES = ["NGN", "GHS", "KES", "ZAR", "USD"];
const TIMEZONES = ["Africa/Lagos", "Africa/Accra", "Africa/Nairobi", "Africa/Johannesburg", "UTC"];

export function SchoolInfoForm() {
  const [state, formAction, isPending] = useActionState(saveSchoolInfo, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">School email</Label>
          <Input id="email" name="email" type="email" placeholder="info@school.edu" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" placeholder="+234..." />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="website">Website</Label>
        <Input id="website" name="website" placeholder="https://school.edu" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="addressLine">Address</Label>
        <Input id="addressLine" name="addressLine" placeholder="12 School Road" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" placeholder="Lagos" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="state">State</Label>
          <Input id="state" name="state" placeholder="Lagos" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="country">Country</Label>
          <Input id="country" name="country" required defaultValue="Nigeria" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="currency">Currency</Label>
          <Select id="currency" name="currency" defaultValue="NGN" required>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="timezone">Timezone</Label>
          <Select id="timezone" name="timezone" defaultValue="Africa/Lagos" required>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </Select>
        </div>
      </div>
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Saving..." : "Continue"}
      </Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
