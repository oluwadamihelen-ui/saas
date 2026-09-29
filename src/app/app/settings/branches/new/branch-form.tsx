"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CURRENCIES, TIMEZONES } from "@/lib/constants";
import { resolveHotelSwitch } from "@/lib/auth/hotel";
import { createBranchAction, type CreateBranchState } from "../actions";

const initialState: CreateBranchState = { status: "idle" };

export function BranchForm() {
  const router = useRouter();
  const { update } = useSession();
  const [state, formAction, isPending] = useActionState(createBranchAction, initialState);

  useEffect(() => {
    if (state.status === "success" && state.hotelId) {
      resolveHotelSwitch(state.hotelId).then(async (result) => {
        await update(result);
        router.push("/app");
        router.refresh();
      });
    }
  }, [state.status, state.hotelId, update, router]);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="hotelName">Hotel name</Label>
        <Input id="hotelName" name="hotelName" required placeholder="Sunrise Hotel — Abuja" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="address">Address</Label>
        <Input id="address" name="address" placeholder="12 Marina Road" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="city">City</Label>
        <Input id="city" name="city" placeholder="Abuja" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="state">State / Region</Label>
        <Input id="state" name="state" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="country">Country</Label>
        <Input id="country" name="country" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone number</Label>
        <Input id="phone" name="phone" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hotelEmail">Hotel email</Label>
        <Input id="hotelEmail" name="hotelEmail" type="email" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="website">Website (optional)</Label>
        <Input id="website" name="website" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="numberOfRooms">Number of rooms</Label>
        <Input id="numberOfRooms" name="numberOfRooms" type="number" min={1} required placeholder="24" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="currency">Currency</Label>
        <Select id="currency" name="currency" required defaultValue="USD">
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="timezone">Timezone</Label>
        <Select id="timezone" name="timezone" required defaultValue="UTC">
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="checkInTime">Check-in time</Label>
        <Input id="checkInTime" name="checkInTime" type="time" required defaultValue="14:00" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="checkOutTime">Check-out time</Label>
        <Input id="checkOutTime" name="checkOutTime" type="time" required defaultValue="12:00" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" name="description" />
      </div>

      <div className="sm:col-span-2">
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Creating branch..." : "Create branch"}
        </Button>
        {state.status === "error" && <p className="mt-2 text-sm text-danger">{state.message}</p>}
      </div>
    </form>
  );
}
