"use client";

import { useActionState, useEffect, useRef } from "react";
import { Select, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createMaintenanceRequestAction, type RequestFormState } from "./actions";
import type { MaintenanceIssueType, MaintenancePriority } from "@/generated/prisma/enums";

const ISSUE_TYPES: MaintenanceIssueType[] = ["AIR_CONDITIONING", "PLUMBING", "ELECTRICAL", "FURNITURE", "TELEVISION", "INTERNET", "OTHER"];
const PRIORITIES: MaintenancePriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const initialState: RequestFormState = { status: "idle" };

export function NewRequestForm({ rooms }: { rooms: { id: string; roomNumber: string }[] }) {
  const [state, formAction, isPending] = useActionState(createMaintenanceRequestAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div className="space-y-1.5">
        <Label>Room (optional)</Label>
        <Select name="roomId">
          <option value="">None (common area)</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.roomNumber}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Issue type</Label>
        <Select name="issueType" defaultValue="OTHER">
          {ISSUE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Priority</Label>
        <Select name="priority" defaultValue="MEDIUM">
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
        <Label>Description</Label>
        <Textarea name="description" required className="min-h-10" />
      </div>
      <div className="flex items-end gap-3">
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input type="checkbox" name="takeRoomOutOfService" /> Take room out of service now
        </label>
      </div>
      <div className="sm:col-span-2 lg:col-span-5">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Reporting..." : "Report Issue"}
        </Button>
        {state.status === "error" && <span className="ml-3 text-sm text-danger">{state.message}</span>}
      </div>
    </form>
  );
}
