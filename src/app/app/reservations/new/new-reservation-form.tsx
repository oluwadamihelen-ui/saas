"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { searchAvailabilityAction, createReservationAction, type AvailabilitySearchResult, type ReservationFormState } from "../actions";

const searchInitial: AvailabilitySearchResult = { status: "idle" };
const createInitial: ReservationFormState = { status: "idle" };

export function NewReservationForm({ roomTypes, currency, defaultSource = "PHONE" }: { roomTypes: { id: string; name: string }[]; currency: string; defaultSource?: string }) {
  const router = useRouter();
  const [searchState, searchAction, searchPending] = useActionState(searchAvailabilityAction, searchInitial);
  const [createState, createAction, createPending] = useActionState(createReservationAction, createInitial);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [dates, setDates] = useState({ checkInDate: "", checkOutDate: "" });

  useEffect(() => {
    if (createState.status === "success" && createState.reservationId) {
      router.push(`/app/reservations/${createState.reservationId}`);
    }
  }, [createState, router]);

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
                {searchPending ? "Searching..." : "Search Availability"}
              </Button>
              {searchState.status === "error" && <span className="ml-3 text-sm text-danger">{searchState.message}</span>}
            </div>
          </form>
        </CardContent>
      </Card>

      {searchState.status === "success" && (
        <Card>
          <CardContent>
            <h3 className="mb-3 text-sm font-semibold text-foreground">Available rooms</h3>
            {searchState.rooms && searchState.rooms.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {searchState.rooms.map((r) => (
                  <label
                    key={r.id}
                    className={`flex cursor-pointer items-center justify-between rounded-md border p-3 text-sm ${selectedRoomId === r.id ? "border-accent bg-accent-soft" : "border-border"}`}
                  >
                    <span>
                      <span className="block font-medium text-foreground">
                        Room {r.roomNumber} {r.floor ? `· Floor ${r.floor}` : ""}
                      </span>
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
              <p className="text-sm text-muted">No rooms available for these dates. Try different dates or a different room type.</p>
            )}
          </CardContent>
        </Card>
      )}

      {selectedRoomId && (
        <Card>
          <CardContent>
            <h3 className="mb-3 text-sm font-semibold text-foreground">Guest & booking details</h3>
            <form action={createAction} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="roomId" value={selectedRoomId} />
              <input type="hidden" name="checkInDate" value={dates.checkInDate} />
              <input type="hidden" name="checkOutDate" value={dates.checkOutDate} />

              <div className="space-y-1.5">
                <Label htmlFor="firstName">Guest first name</Label>
                <Input id="firstName" name="firstName" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Guest last name</Label>
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
                <Label htmlFor="discount">Discount</Label>
                <Input id="discount" name="discount" type="number" min={0} step="0.01" defaultValue={0} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="source">Booking source</Label>
                <Select id="source" name="source" defaultValue={defaultSource}>
                  <option value="ONLINE">Online Booking</option>
                  <option value="WALK_IN">Walk-in</option>
                  <option value="PHONE">Phone Booking</option>
                  <option value="CORPORATE">Corporate Booking</option>
                  <option value="TRAVEL_AGENT">Travel Agent Booking</option>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={createPending}>
                  {createPending ? "Creating..." : "Create Reservation"}
                </Button>
                {createState.status === "error" && <span className="ml-3 text-sm text-danger">{createState.message}</span>}
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
