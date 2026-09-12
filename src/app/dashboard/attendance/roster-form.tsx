"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { markAttendanceAction, type MarkAttendanceState } from "./actions";

const initialState: MarkAttendanceState = { status: "idle" };

type Status = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "PRESENT", label: "Present" },
  { value: "ABSENT", label: "Absent" },
  { value: "LATE", label: "Late" },
  { value: "EXCUSED", label: "Excused" },
];

export function RosterForm({
  classArmId,
  date,
  roster,
}: {
  classArmId: string;
  date: string;
  roster: { student: { id: string; firstName: string; lastName: string }; record: { status: Status } | null }[];
}) {
  const action = markAttendanceAction.bind(null, classArmId, date);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [statuses, setStatuses] = useState<Record<string, Status>>(
    Object.fromEntries(roster.map((r) => [r.student.id, r.record?.status ?? "PRESENT"]))
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setStatuses(Object.fromEntries(roster.map((r) => [r.student.id, "PRESENT" as Status])))}
        >
          Mark all present
        </Button>
        <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save attendance"}</Button>
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border">
        {roster.map(({ student }) => (
          <li key={student.id} className="flex items-center justify-between gap-3 p-3">
            <div className="flex items-center gap-3">
              <Avatar name={`${student.firstName} ${student.lastName}`} />
              <span className="text-sm font-medium text-foreground">{student.firstName} {student.lastName}</span>
            </div>
            <Select
              name={`status_${student.id}`}
              className="w-36"
              value={statuses[student.id]}
              onChange={(e) => setStatuses((prev) => ({ ...prev, [student.id]: e.target.value as Status }))}
            >
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </li>
        ))}
      </ul>

      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
      {state.status === "success" && <p className="text-sm text-success">{state.message}</p>}
    </form>
  );
}
