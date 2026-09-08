"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label, Select, Textarea } from "@/components/ui/input";
import { updateApplicantStatusAction, type AdmissionActionState } from "../actions";

const initialState: AdmissionActionState = { status: "idle" };

const NEXT_STATUS: Record<string, { value: string; label: string }[]> = {
  APPLIED: [{ value: "UNDER_REVIEW", label: "Move to under review" }, { value: "REJECTED", label: "Reject" }],
  UNDER_REVIEW: [{ value: "OFFERED", label: "Make an offer" }, { value: "REJECTED", label: "Reject" }],
  OFFERED: [{ value: "ACCEPTED", label: "Mark accepted" }, { value: "REJECTED", label: "Reject" }],
};

export function StatusForm({ applicantId, status }: { applicantId: string; status: string }) {
  const [state, formAction, isPending] = useActionState(updateApplicantStatusAction, initialState);
  const options = NEXT_STATUS[status] ?? [];
  if (options.length === 0) return null;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="applicantId" value={applicantId} />
      <div className="space-y-1.5">
        <Label htmlFor="status">Update status</Label>
        <Select id="status" name="status" required defaultValue="">
          <option value="" disabled>Choose an action</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" name="notes" rows={2} />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Saving..." : "Update"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
      {state.status === "success" && <p className="text-sm text-success">Applicant updated.</p>}
    </form>
  );
}
