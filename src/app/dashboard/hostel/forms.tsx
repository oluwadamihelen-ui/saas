"use client";

import { useActionState, useEffect, useRef } from "react";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createHostelAction, addHostelRoomAction, assignStudentToRoomAction, type HostelFormState } from "./actions";

const initialState: HostelFormState = { status: "idle" };

export function AddHostelForm() {
  const [state, formAction, isPending] = useActionState(createHostelAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === "success") formRef.current?.reset(); }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="hostelName">Name</Label>
          <Input id="hostelName" name="name" required placeholder="Unity Hostel" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hostelType">Type</Label>
          <Select id="hostelType" name="type" defaultValue="MIXED">
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="MIXED">Mixed</option>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="wardenName">Warden (optional)</Label>
          <Input id="wardenName" name="wardenName" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wardenPhone">Warden phone (optional)</Label>
          <Input id="wardenPhone" name="wardenPhone" />
        </div>
      </div>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Adding..." : "Add hostel"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function AddRoomForm({ hostelId }: { hostelId: string }) {
  const [state, formAction, isPending] = useActionState(addHostelRoomAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === "success") formRef.current?.reset(); }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="hostelId" value={hostelId} />
      <div className="w-40 space-y-1.5">
        <Label htmlFor="roomNumber">Room number</Label>
        <Input id="roomNumber" name="roomNumber" required placeholder="A1" />
      </div>
      <div className="w-32 space-y-1.5">
        <Label htmlFor="capacity">Capacity (beds)</Label>
        <Input id="capacity" name="capacity" type="number" min={1} required />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Adding..." : "Add room"}</Button>
      {state.status === "error" && <p className="w-full text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function AssignStudentForm({
  hostelId,
  rooms,
  students,
}: {
  hostelId: string;
  rooms: { id: string; roomNumber: string; availableBeds: number }[];
  students: { id: string; firstName: string; lastName: string; admissionNumber: string }[];
}) {
  const [state, formAction, isPending] = useActionState(assignStudentToRoomAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === "success") formRef.current?.reset(); }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="hostelId" value={hostelId} />
      <div className="w-64 space-y-1.5">
        <Label htmlFor="studentId">Student</Label>
        <Select id="studentId" name="studentId" required defaultValue="">
          <option value="" disabled>Select student</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNumber})</option>)}
        </Select>
      </div>
      <div className="w-40 space-y-1.5">
        <Label htmlFor="roomId">Room</Label>
        <Select id="roomId" name="roomId" required defaultValue="">
          <option value="" disabled>Select room</option>
          {rooms.filter((r) => r.availableBeds > 0).map((r) => (
            <option key={r.id} value={r.id}>{r.roomNumber} ({r.availableBeds} free)</option>
          ))}
        </Select>
      </div>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Assigning..." : "Assign to room"}</Button>
      {state.status === "error" && <p className="w-full text-sm text-danger">{state.message}</p>}
    </form>
  );
}
