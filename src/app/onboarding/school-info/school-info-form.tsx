"use client";

import { useActionState, useState } from "react";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { saveSchoolInfo, type SchoolInfoState } from "./actions";

import { useActionToast } from "@/hooks/use-action-toast";

const initialState: SchoolInfoState = { status: "idle" };

const CURRENCIES = ["NGN", "GHS", "KES", "ZAR", "USD"];
const TIMEZONES = ["Africa/Lagos", "Africa/Accra", "Africa/Nairobi", "Africa/Johannesburg", "UTC"];

// A starting point only — pre-filled into an editable field, never saved
// without the school seeing and (implicitly, by submitting) confirming it.
function suggestAbbreviation(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 10);
}

export function SchoolInfoForm({ schoolName, currentPrefix }: { schoolName: string; currentPrefix: string | null }) {
  const [state, formAction, isPending] = useActionState(saveSchoolInfo, initialState);
  useActionToast(state);
  const [prefix, setPrefix] = useState(currentPrefix ?? suggestAbbreviation(schoolName));

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="admissionNumberPrefix">School abbreviation</Label>
        <Input
          id="admissionNumberPrefix"
          name="admissionNumberPrefix"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          placeholder="e.g. WMS"
          maxLength={10}
          className="uppercase"
        />
        <p className="text-xs text-muted">
          Suggested from your school name — used as the prefix for admission numbers, e.g.{" "}
          <span className="font-mono">{(prefix.trim() || "WMS").toUpperCase()}-2026-0001</span>. Feel free to change it before continuing.
        </p>
      </div>
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
