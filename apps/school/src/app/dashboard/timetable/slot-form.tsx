"use client";

import { useActionState, useEffect, useRef } from "react";
import { Label, Select, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createSlotAction, type SlotFormState } from "./actions";

const initialState: SlotFormState = { status: "idle" };

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

export function SlotForm({
  classArmId,
  subjects,
  teachers,
}: {
  classArmId: string;
  subjects: { id: string; name: string }[];
  teachers: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(createSlotAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-4">
      <input type="hidden" name="classArmId" value={classArmId} />
      <div className="w-36 space-y-1.5">
        <Label htmlFor="dayOfWeek">Day</Label>
        <Select id="dayOfWeek" name="dayOfWeek" required defaultValue="MONDAY">
          {DAYS.map((d) => <option key={d} value={d}>{d[0]}{d.slice(1).toLowerCase()}</option>)}
        </Select>
      </div>
      <div className="w-28 space-y-1.5">
        <Label htmlFor="startTime">Start</Label>
        <Input id="startTime" name="startTime" type="time" required defaultValue="08:00" />
      </div>
      <div className="w-28 space-y-1.5">
        <Label htmlFor="endTime">End</Label>
        <Input id="endTime" name="endTime" type="time" required defaultValue="08:40" />
      </div>
      <div className="w-48 space-y-1.5">
        <Label htmlFor="subjectId">Subject</Label>
        <Select id="subjectId" name="subjectId" required defaultValue="">
          <option value="" disabled>Select subject</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </div>
      <div className="w-48 space-y-1.5">
        <Label htmlFor="teacherId">Teacher</Label>
        <Select id="teacherId" name="teacherId" required defaultValue="">
          <option value="" disabled>Select teacher</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      </div>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Adding..." : "Add period"}</Button>
      {state.status === "error" && <p className="w-full text-sm text-danger">{state.message}</p>}
    </form>
  );
}
