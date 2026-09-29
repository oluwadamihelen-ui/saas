"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CURRENCIES, TIMEZONES } from "@/lib/constants";
import { registerHotel, type RegisterState } from "./actions";

const initialState: RegisterState = { status: "idle" };

export function RegisterForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(registerHotel, initialState);

  useEffect(() => {
    if (state.status === "success") {
      const form = document.getElementById("register-form") as HTMLFormElement | null;
      const email = (form?.elements.namedItem("ownerEmail") as HTMLInputElement | null)?.value;
      const password = (form?.elements.namedItem("ownerPassword") as HTMLInputElement | null)?.value;
      if (email && password) {
        signIn("credentials", { email, password, redirect: false }).then(() => {
          router.push("/app");
          router.refresh();
        });
      }
    }
  }, [state.status, router]);

  return (
    <form id="register-form" action={formAction} className="space-y-8">
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Hotel details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="hotelName">Hotel name</Label>
            <Input id="hotelName" name="hotelName" required placeholder="Sunrise Hotel" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" placeholder="12 Marina Road" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" placeholder="Lagos" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="state">State / Region</Label>
            <Input id="state" name="state" placeholder="Lagos State" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="country">Country</Label>
            <Input id="country" name="country" placeholder="Nigeria" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone number</Label>
            <Input id="phone" name="phone" placeholder="+234 800 000 0000" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hotelEmail">Hotel email</Label>
            <Input id="hotelEmail" name="hotelEmail" type="email" placeholder="info@sunrisehotel.example" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="website">Website (optional)</Label>
            <Input id="website" name="website" placeholder="https://sunrisehotel.example" />
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
            <Textarea id="description" name="description" placeholder="A boutique hotel in the heart of the city..." />
          </div>
        </div>
      </section>

      <section className="space-y-4 border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-foreground">Your owner account</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ownerName">Full name</Label>
            <Input id="ownerName" name="ownerName" required placeholder="Jane Doe" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ownerEmail">Email</Label>
            <Input id="ownerEmail" name="ownerEmail" type="email" required placeholder="jane@sunrisehotel.example" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ownerPassword">Password</Label>
            <Input id="ownerPassword" name="ownerPassword" type="password" required minLength={8} placeholder="At least 8 characters" />
          </div>
        </div>
      </section>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Creating your hotel..." : "Create my hotel"}
      </Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
