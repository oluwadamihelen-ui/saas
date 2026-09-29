"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { searchAvailabilityAction, type AvailabilitySearchResult } from "../../reservations/actions";
import { createWalkInAction, type WalkInFormState } from "../actions";
import type { PaymentMethod } from "@/generated/prisma/enums";

const searchInitial: AvailabilitySearchResult = { status: "idle" };
const walkInInitial: WalkInFormState = { status: "idle" };
const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "BANK_TRANSFER", "CARD", "POS", "ONLINE_PAYMENT", "PAYMENT_LINK", "OTHER"];

function today() {
  return new Date().toISOString().slice(0, 10);
}
function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function WalkInForm({ roomTypes, currency }: { roomTypes: { id: string; name: string }[]; currency: string }) {
  const router = useRouter();
  const [searchState, searchAction, searchPending] = useActionState(searchAvailabilityAction, searchInitial);
  const [walkInState, walkInAction, walkInPending] = useActionState(createWalkInAction, walkInInitial);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [dates, setDates] = useState({ checkInDate: today(), checkOutDate: tomorrow() });

  useEffect(() => {
    if (walkInState.status === "success" && walkInState.reservationId) {
      router.push(`/app/reservations/${walkInState.reservationId}`);
    }
  }, [walkInState, router]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <form action={searchAction} className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="checkInDate">Check-in date</Label>
              <Input id="checkInDate" name="checkInDate" type="date" required value={dates.checkInDate} onChange={(e) => setDates((d) => ({ ...d, checkInDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="checkOutDate">Check-out date</Label>
              <Input id="checkOutDate" name="checkOutDate" type="date" required value={dates.checkOutDate} onChange={(e) => setDates((d) => ({ ...d, checkOutDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guests">Guests</Label>
              <Input id="guests" name="guests" type="number" min={1} defaultValue={1} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="roomTypeId">Room type</Label>
              <Select id="roomTypeId" name="roomTypeId">
                <option value="">Any</option>
                {roomTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-4">
              <Button type="submit" disabled={searchPending}>
                {searchPending ? "Searching..." : "Search Available Rooms"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {searchState.status === "success" && (
        <Card>
          <CardContent>
            <h3 className="mb-3 text-sm font-semibold text-foreground">Select a room</h3>
            {searchState.rooms && searchState.rooms.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {searchState.rooms.map((r) => (
                  <label
                    key={r.id}
                    className={`flex cursor-pointer items-center justify-between rounded-md border p-3 text-sm ${selectedRoomId === r.id ? "border-accent bg-accent-soft" : "border-border"}`}
                  >
                    <span>
                      <span className="block font-medium text-foreground">Room {r.roomNumber}</span>
                      <span className="text-xs text-muted">{r.roomTypeName}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-accent">{formatCurrency(r.rate, currency)}</span>
                      <input type="radio" name="roomPick" checked={selectedRoomId === r.id} onChange={() => setSelectedRoomId(r.id)} />
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">No rooms available for these dates.</p>
            )}
          </CardContent>
        </Card>
      )}

      {selectedRoomId && (
        <Card>
          <CardContent>
            <h3 className="mb-3 text-sm font-semibold text-foreground">Guest details & payment</h3>
            <form action={walkInAction} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="roomId" value={selectedRoomId} />
              <input type="hidden" name="checkInDate" value={dates.checkInDate} />
              <input type="hidden" name="checkOutDate" value={dates.checkOutDate} />

              <div className="space-y-1.5">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" name="firstName" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" name="lastName" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adults">Adults</Label>
                <Input id="adults" name="adults" type="number" min={1} defaultValue={1} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="children">Children</Label>
                <Input id="children" name="children" type="number" min={0} defaultValue={0} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="paymentAmount">Payment amount (optional)</Label>
                <Input id="paymentAmount" name="paymentAmount" type="number" min={0} step="0.01" placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="paymentMethod">Payment method</Label>
                <Select id="paymentMethod" name="paymentMethod" defaultValue="CASH">
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m.replaceAll("_", " ")}
                    </option>
                  ))}
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
                <input type="checkbox" name="checkInNow" defaultChecked />
                Check in immediately
              </label>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={walkInPending}>
                  {walkInPending ? "Registering..." : "Complete Walk-in"}
                </Button>
                {walkInState.status === "error" && <span className="ml-3 text-sm text-danger">{walkInState.message}</span>}
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
