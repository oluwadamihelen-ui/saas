"use client";

import { useActionState, useEffect, useRef } from "react";
import { Select, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createHousekeepingTaskAction, type TaskFormState } from "./actions";
import type { HousekeepingTaskType } from "@/generated/prisma/enums";

const TASK_TYPES: HousekeepingTaskType[] = ["CLEAN_ROOM", "CHANGE_BEDSHEETS", "REPLACE_TOWELS", "RESTOCK_AMENITIES", "DEEP_CLEANING", "INSPECTION"];
const initialState: TaskFormState = { status: "idle" };

export function NewTaskForm({ rooms, staff }: { rooms: { id: string; roomNumber: string }[]; staff: { id: string; name: string }[] }) {
  const [state, formAction, isPending] = useActionState(createHousekeepingTaskAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label>Room</Label>
        <Select name="roomId" required className="w-40">
          <option value="">Select room</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.roomNumber}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Task</Label>
        <Select name="taskType" defaultValue="CLEAN_ROOM" className="w-48">
          {TASK_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Assign to</Label>
        <Select name="assignedToId" className="w-44">
          <option value="">Unassigned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create Task"}
      </Button>
      {state.status === "error" && <span className="text-sm text-danger">{state.message}</span>}
    </form>
  );
}
