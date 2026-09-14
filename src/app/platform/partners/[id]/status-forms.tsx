"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import {
  approvePartnerApplicationAction,
  rejectPartnerApplicationAction,
  suspendPartnerAction,
  reactivatePartnerAction,
  type PlatformFormState,
} from "../actions";

const initialState: PlatformFormState = { status: "idle" };

export function ApprovePartnerForm({ partnerId }: { partnerId: string }) {
  const [state, formAction, isPending] = useActionState(approvePartnerApplicationAction, initialState);
  useActionToast(state);
  return (
    <form action={formAction}>
      <input type="hidden" name="partnerId" value={partnerId} />
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Approving..." : "Approve application"}</Button>
    </form>
  );
}

function ReasonForm({
  partnerId,
  action,
  label,
  pendingLabel,
  variant = "secondary",
}: {
  partnerId: string;
  action: (prev: PlatformFormState, formData: FormData) => Promise<PlatformFormState>;
  label: string;
  pendingLabel: string;
  variant?: "secondary" | "destructive" | "ghost";
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  useActionToast(state);
  const [open, setOpen] = useState(false);

  if (!open) {
    return <Button type="button" size="sm" variant={variant} onClick={() => setOpen(true)}>{label}</Button>;
  }

  return (
    <form action={formAction} className="space-y-2 rounded-md border border-border p-3">
      <input type="hidden" name="partnerId" value={partnerId} />
      <Textarea name="reason" required placeholder="Reason (required)" rows={2} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant={variant} disabled={isPending}>{isPending ? pendingLabel : label}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}

export function RejectPartnerForm({ partnerId }: { partnerId: string }) {
  return <ReasonForm partnerId={partnerId} action={rejectPartnerApplicationAction} label="Reject application" pendingLabel="Rejecting..." variant="destructive" />;
}

export function SuspendPartnerForm({ partnerId }: { partnerId: string }) {
  return <ReasonForm partnerId={partnerId} action={suspendPartnerAction} label="Suspend Partner" pendingLabel="Suspending..." variant="destructive" />;
}

export function ReactivatePartnerForm({ partnerId }: { partnerId: string }) {
  const [state, formAction, isPending] = useActionState(reactivatePartnerAction, initialState);
  useActionToast(state);
  return (
    <form action={formAction}>
      <input type="hidden" name="partnerId" value={partnerId} />
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Reactivating..." : "Reactivate Partner"}</Button>
    </form>
  );
}
