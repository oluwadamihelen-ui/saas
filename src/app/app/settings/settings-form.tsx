"use client";

import { useActionState } from "react";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CURRENCIES, TIMEZONES } from "@/lib/constants";
import { updateSettingsAction, type SettingsFormState } from "./actions";

const initial: SettingsFormState = { status: "idle" };

export function SettingsForm({ hotel }: { hotel: Record<string, string> }) {
  const [state, formAction, isPending] = useActionState(updateSettingsAction, initial);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="name">Hotel name</Label>
        <Input id="name" name="name" required defaultValue={hotel.name} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="address">Address</Label>
        <Input id="address" name="address" defaultValue={hotel.address} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="city">City</Label>
        <Input id="city" name="city" defaultValue={hotel.city} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="state">State</Label>
        <Input id="state" name="state" defaultValue={hotel.state} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="country">Country</Label>
        <Input id="country" name="country" defaultValue={hotel.country} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" defaultValue={hotel.phone} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" defaultValue={hotel.email} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="website">Website</Label>
        <Input id="website" name="website" defaultValue={hotel.website} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="logoUrl">Logo URL</Label>
        <Input id="logoUrl" name="logoUrl" defaultValue={hotel.logoUrl} placeholder="https://..." />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="currency">Currency</Label>
        <Select id="currency" name="currency" defaultValue={hotel.currency}>
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="timezone">Timezone</Label>
        <Select id="timezone" name="timezone" defaultValue={hotel.timezone}>
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="checkInTime">Check-in time</Label>
        <Input id="checkInTime" name="checkInTime" type="time" defaultValue={hotel.checkInTime} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="checkOutTime">Check-out time</Label>
        <Input id="checkOutTime" name="checkOutTime" type="time" defaultValue={hotel.checkOutTime} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="taxRatePercent">Tax rate (%)</Label>
        <Input id="taxRatePercent" name="taxRatePercent" type="number" min={0} max={100} step="0.01" defaultValue={hotel.taxRatePercent} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="invoicePrefix">Invoice prefix</Label>
        <Input id="invoicePrefix" name="invoicePrefix" defaultValue={hotel.invoicePrefix} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reservationPrefix">Reservation prefix</Label>
        <Input id="reservationPrefix" name="reservationPrefix" defaultValue={hotel.reservationPrefix} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" defaultValue={hotel.description} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save Settings"}
        </Button>
        {state.status !== "idle" && (
          <span className={`ml-3 text-sm ${state.status === "success" ? "text-success" : "text-danger"}`}>{state.message}</span>
        )}
      </div>
    </form>
  );
}
