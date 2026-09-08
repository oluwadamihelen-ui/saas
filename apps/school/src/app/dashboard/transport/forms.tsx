"use client";

import { useActionState, useEffect, useRef } from "react";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createVehicleAction, createRouteAction, addRouteStopAction, assignStudentToRouteAction, type TransportFormState } from "./actions";

const initialState: TransportFormState = { status: "idle" };

export function AddVehicleForm() {
  const [state, formAction, isPending] = useActionState(createVehicleAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === "success") formRef.current?.reset(); }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="vehicleName">Name</Label>
          <Input id="vehicleName" name="name" required placeholder="Bus 1" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="plateNumber">Plate number</Label>
          <Input id="plateNumber" name="plateNumber" required placeholder="ABC-123-XY" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="capacity">Capacity</Label>
          <Input id="capacity" name="capacity" type="number" min={1} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="driverName">Driver (optional)</Label>
          <Input id="driverName" name="driverName" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="driverPhone">Driver phone (optional)</Label>
          <Input id="driverPhone" name="driverPhone" />
        </div>
      </div>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Adding..." : "Add vehicle"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function AddRouteForm({ vehicles }: { vehicles: { id: string; name: string }[] }) {
  const [state, formAction, isPending] = useActionState(createRouteAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === "success") formRef.current?.reset(); }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="w-56 space-y-1.5">
        <Label htmlFor="routeName">Route name</Label>
        <Input id="routeName" name="name" required placeholder="Route A - Ikeja" />
      </div>
      <div className="w-56 space-y-1.5">
        <Label htmlFor="vehicleId">Vehicle (optional)</Label>
        <Select id="vehicleId" name="vehicleId" defaultValue="">
          <option value="">No vehicle yet</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </Select>
      </div>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Adding..." : "Add route"}</Button>
      {state.status === "error" && <p className="w-full text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function AddStopForm({ routeId, nextOrder }: { routeId: string; nextOrder: number }) {
  const [state, formAction, isPending] = useActionState(addRouteStopAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === "success") formRef.current?.reset(); }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="routeId" value={routeId} />
      <div className="w-48 space-y-1.5">
        <Label htmlFor="stopName">Stop name</Label>
        <Input id="stopName" name="name" required placeholder="Allen Avenue Junction" />
      </div>
      <div className="w-24 space-y-1.5">
        <Label htmlFor="order">Order</Label>
        <Input id="order" name="order" type="number" min={0} defaultValue={nextOrder} required />
      </div>
      <div className="w-36 space-y-1.5">
        <Label htmlFor="pickupTime">Pickup time</Label>
        <Input id="pickupTime" name="pickupTime" type="time" />
      </div>
      <div className="w-36 space-y-1.5">
        <Label htmlFor="dropoffTime">Drop-off time</Label>
        <Input id="dropoffTime" name="dropoffTime" type="time" />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Adding..." : "Add stop"}</Button>
      {state.status === "error" && <p className="w-full text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function AssignStudentForm({
  routeId,
  stops,
  students,
}: {
  routeId: string;
  stops: { id: string; name: string }[];
  students: { id: string; firstName: string; lastName: string; admissionNumber: string }[];
}) {
  const [state, formAction, isPending] = useActionState(assignStudentToRouteAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === "success") formRef.current?.reset(); }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="routeId" value={routeId} />
      <div className="w-64 space-y-1.5">
        <Label htmlFor="studentId">Student</Label>
        <Select id="studentId" name="studentId" required defaultValue="">
          <option value="" disabled>Select student</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNumber})</option>)}
        </Select>
      </div>
      <div className="w-48 space-y-1.5">
        <Label htmlFor="stopId">Stop (optional)</Label>
        <Select id="stopId" name="stopId" defaultValue="">
          <option value="">No specific stop</option>
          {stops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </div>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Assigning..." : "Assign to route"}</Button>
      {state.status === "error" && <p className="w-full text-sm text-danger">{state.message}</p>}
    </form>
  );
}
