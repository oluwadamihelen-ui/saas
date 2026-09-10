"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { RoomTypeFormState } from "./actions";

const initialState: RoomTypeFormState = { status: "idle" };

export function RoomTypeForm({
  action,
  submitLabel,
  defaultValues,
}: {
  action: (prev: RoomTypeFormState, formData: FormData) => Promise<RoomTypeFormState>;
  submitLabel: string;
  defaultValues?: {
    name: string;
    description: string;
    maxGuests: number;
    numBeds: number;
    bedType: string;
    amenities: string;
    basePrice: number;
  };
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.status === "success") router.push("/app/room-types");
  }, [state.status, router]);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required defaultValue={defaultValues?.name} placeholder="Deluxe Room" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" defaultValue={defaultValues?.description} placeholder="Spacious room with a king bed and city view..." />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="maxGuests">Maximum guests</Label>
        <Input id="maxGuests" name="maxGuests" type="number" min={1} required defaultValue={defaultValues?.maxGuests ?? 2} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="numBeds">Number of beds</Label>
        <Input id="numBeds" name="numBeds" type="number" min={1} required defaultValue={defaultValues?.numBeds ?? 1} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bedType">Bed type</Label>
        <Input id="bedType" name="bedType" defaultValue={defaultValues?.bedType} placeholder="King" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="basePrice">Base price (per night)</Label>
        <Input id="basePrice" name="basePrice" type="number" min={0} step="0.01" required defaultValue={defaultValues?.basePrice} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="amenities">Amenities (one per line or comma-separated)</Label>
        <Textarea id="amenities" name="amenities" defaultValue={defaultValues?.amenities} placeholder="Wi-Fi&#10;Air conditioning&#10;Mini bar" />
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
