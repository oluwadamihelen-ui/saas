"use client";

import { useState, useTransition } from "react";
import { Select, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { RoomStatus } from "@/generated/prisma/enums";
import { overrideRoomStatusAction } from "./actions";

const STATUSES: RoomStatus[] = ["AVAILABLE", "RESERVED", "OCCUPIED", "DIRTY", "CLEANING", "INSPECTED", "MAINTENANCE", "OUT_OF_SERVICE"];

export function RoomStatusControl({ roomId, currentStatus }: { roomId: string; currentStatus: RoomStatus }) {
  const [status, setStatus] = useState<RoomStatus>(currentStatus);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await overrideRoomStatusAction(roomId, status, reason);
        setReason("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to update status.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted">New status</label>
        <Select value={status} onChange={(e) => setStatus(e.target.value as RoomStatus)} className="w-44">
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted">Reason (optional)</label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Deep clean requested" className="w-56" />
      </div>
      <Button type="submit" disabled={isPending || status === currentStatus} variant="secondary">
        {isPending ? "Updating..." : "Update Status"}
      </Button>
      {error && <p className="w-full text-sm text-danger">{error}</p>}
    </form>
  );
}
