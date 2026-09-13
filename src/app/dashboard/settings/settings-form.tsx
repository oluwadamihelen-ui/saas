"use client";

import { useActionState, useState } from "react";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { saveSchoolSettings, type SettingsState } from "./actions";
import type { School } from "@/generated/prisma/client";

const initialState: SettingsState = { status: "idle" };
const CURRENCIES = ["NGN", "GHS", "KES", "ZAR", "USD"];
const TIMEZONES = ["Africa/Lagos", "Africa/Accra", "Africa/Nairobi", "Africa/Johannesburg", "UTC"];

export function SettingsForm({ school, studentCount }: { school: School; studentCount: number }) {
  const [state, formAction, isPending] = useActionState(saveSchoolSettings, initialState);
  const [prefix, setPrefix] = useState(school.admissionNumberPrefix ?? "");

  const normalizedPreviewPrefix = prefix.trim().toUpperCase();
  const nextSequence = String(studentCount + 1).padStart(4, "0");
  const year = new Date().getFullYear();
  const previewAdmissionNumber = normalizedPreviewPrefix
    ? `${normalizedPreviewPrefix}-${year}-${nextSequence}`
    : `${year}-${nextSequence}`;
  const prefixChanged = normalizedPreviewPrefix !== (school.admissionNumberPrefix ?? "");

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">School name</Label>
        <Input id="name" name="name" required defaultValue={school.name} />
      </div>
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
          Used as the prefix for new admission numbers, e.g. <span className="font-mono">{previewAdmissionNumber}</span>. 2-10 letters/numbers, no
          spaces. Leave blank to keep the plain {year}-{nextSequence} format.
        </p>
        {studentCount > 0 && prefixChanged && (
          <p className="text-xs text-warning">
            Changing this only affects newly generated admission numbers — your {studentCount} existing student
            {studentCount === 1 ? "" : "s"} will keep the admission number{studentCount === 1 ? "" : "s"} they already have.
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">School email</Label>
          <Input id="email" name="email" type="email" defaultValue={school.email ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={school.phone ?? ""} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="website">Website</Label>
        <Input id="website" name="website" defaultValue={school.website ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="addressLine">Address</Label>
        <Input id="addressLine" name="addressLine" defaultValue={school.addressLine ?? ""} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" defaultValue={school.city ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="state">State</Label>
          <Input id="state" name="state" defaultValue={school.state ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="country">Country</Label>
          <Input id="country" name="country" required defaultValue={school.country} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="currency">Currency</Label>
          <Select id="currency" name="currency" defaultValue={school.currency} required>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="timezone">Timezone</Label>
          <Select id="timezone" name="timezone" defaultValue={school.timezone} required>
            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </Select>
        </div>
      </div>
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Bank details</h3>
        <p className="mb-3 text-xs text-muted">Shown to parents on the pay page as a bank-transfer option. Leave blank to hide it.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="bankName">Bank name</Label>
            <Input id="bankName" name="bankName" defaultValue={school.bankName ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bankAccountName">Account name</Label>
            <Input id="bankAccountName" name="bankAccountName" defaultValue={school.bankAccountName ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bankAccountNumber">Account number</Label>
            <Input id="bankAccountNumber" name="bankAccountNumber" defaultValue={school.bankAccountNumber ?? ""} />
          </div>
        </div>
      </div>
      <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save changes"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
      {state.status === "success" && <p className="text-sm text-success">{state.message}</p>}
    </form>
  );
}
