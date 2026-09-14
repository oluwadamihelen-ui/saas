"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import {
  markWithdrawalUnderReviewAction,
  approveWithdrawalAction,
  rejectWithdrawalAction,
  markWithdrawalPaidAction,
  type PlatformFormState,
} from "../actions";

const initialState: PlatformFormState = { status: "idle" };

export function MarkUnderReviewButton({ withdrawalId }: { withdrawalId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={isPending}
      onClick={() => startTransition(async () => { await markWithdrawalUnderReviewAction(withdrawalId); router.refresh(); })}
    >
      Mark under review
    </Button>
  );
}

export function ApproveWithdrawalButton({ withdrawalId }: { withdrawalId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button
      size="sm"
      disabled={isPending}
      onClick={() => startTransition(async () => { await approveWithdrawalAction(withdrawalId); router.refresh(); })}
    >
      Approve
    </Button>
  );
}

export function RejectWithdrawalForm({ withdrawalId }: { withdrawalId: string }) {
  const [state, formAction, isPending] = useActionState(rejectWithdrawalAction, initialState);
  useActionToast(state);
  const [open, setOpen] = useState(false);

  if (!open) return <Button type="button" size="sm" variant="destructive" onClick={() => setOpen(true)}>Reject</Button>;

  return (
    <form action={formAction} className="space-y-2 rounded-md border border-border p-3">
      <input type="hidden" name="withdrawalId" value={withdrawalId} />
      <Textarea name="reason" required placeholder="Reason (required)" rows={2} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="destructive" disabled={isPending}>{isPending ? "Rejecting..." : "Reject"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}

export function MarkPaidForm({ withdrawalId }: { withdrawalId: string }) {
  const [state, formAction, isPending] = useActionState(markWithdrawalPaidAction, initialState);
  useActionToast(state);
  const [open, setOpen] = useState(false);

  if (!open) return <Button type="button" size="sm" onClick={() => setOpen(true)}>Mark paid</Button>;

  return (
    <form action={formAction} className="space-y-2 rounded-md border border-border p-3">
      <input type="hidden" name="withdrawalId" value={withdrawalId} />
      <Input name="payoutReference" required placeholder="Payout reference (bank transfer ref, etc.)" />
      <Textarea name="notes" placeholder="Notes (optional)" rows={2} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Saving..." : "Mark paid"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}
