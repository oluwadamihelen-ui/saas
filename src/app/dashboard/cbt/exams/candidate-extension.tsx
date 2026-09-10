"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { grantExtensionAction } from "./actions";

export function CandidateExtension({
  candidateId,
  extraTimeMinutes,
  extensionReason,
  canGrant,
}: {
  candidateId: string;
  extraTimeMinutes: number;
  extensionReason: string | null;
  canGrant: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [minutes, setMinutes] = useState(String(extraTimeMinutes));
  const [reason, setReason] = useState(extensionReason ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!canGrant) {
    return <span>{extraTimeMinutes > 0 ? `+${extraTimeMinutes} min` : "—"}</span>;
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span>{extraTimeMinutes > 0 ? `+${extraTimeMinutes} min` : "—"}</span>
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          Extend
        </Button>
      </div>
    );
  }

  return (
    <div className="w-56 space-y-1.5 rounded-md border border-border p-2">
      <div className="flex items-center gap-1.5">
        <Label className="sr-only" htmlFor={`extra-time-${candidateId}`}>
          Extra minutes
        </Label>
        <Input
          id={`extra-time-${candidateId}`}
          type="number"
          min={0}
          className="h-8 w-16"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
        />
        <span className="text-xs text-muted">min</span>
      </div>
      <Input
        placeholder="Reason (optional)"
        className="h-8"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-1.5">
        <Button
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const parsed = Number(minutes);
              if (!Number.isFinite(parsed) || parsed < 0) {
                setError("Enter a valid number of minutes.");
                return;
              }
              const result = await grantExtensionAction(candidateId, parsed, reason.trim() || null);
              if (result.status === "error") {
                setError(result.message ?? "Could not save.");
                return;
              }
              setEditing(false);
              router.refresh();
            })
          }
        >
          {isPending ? "Saving..." : "Save"}
        </Button>
        <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
