"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { RoomFormState } from "./actions";

const initialState: RoomFormState = { status: "idle" };

export function RoomForm({
  action,
  submitLabel,
  roomTypes,
  redirectTo = "/app/rooms",
  defaultValues,
}: {
  action: (prev: RoomFormState, formData: FormData) => Promise<RoomFormState>;
  submitLabel: string;
  roomTypes: { id: string; name: string }[];
  redirectTo?: string;
  defaultValues?: { roomTypeId: string; roomNumber: string; floor: string; price: number | ""; amenities: string; description: string };
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.status === "success") router.push(redirectTo);
  }, [state.status, router, redirectTo]);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="roomNumber">Room number</Label>
        <Input id="roomNumber" name="roomNumber" required defaultValue={defaultValues?.roomNumber} placeholder="101" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="roomTypeId">Room type</Label>
        <Select id="roomTypeId" name="roomTypeId" required defaultValue={defaultValues?.roomTypeId}>
          <option value="">Select room type</option>
          {roomTypes.map((rt) => (
            <option key={rt.id} value={rt.id}>
              {rt.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="floor">Floor</Label>
        <Input id="floor" name="floor" defaultValue={defaultValues?.floor} placeholder="1" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="price">Price override (optional)</Label>
        <Input id="price" name="price" type="number" min={0} step="0.01" defaultValue={defaultValues?.price} placeholder="Uses room type base price" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" defaultValue={defaultValues?.description} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="amenities">Amenities (one per line or comma-separated)</Label>
        <Textarea id="amenities" name="amenities" defaultValue={defaultValues?.amenities} placeholder="Balcony&#10;Sea view" />
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
