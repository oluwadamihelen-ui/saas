"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import { useSafeAction } from "@/hooks/use-safe-action";
import { CopyCredentialsButton } from "@/components/dashboard/copy-credentials-button";
import {
  suspendBuyerAction,
  reactivateBuyerAction,
  resetBuyerPasswordAction,
  attributeBuyerReferralAction,
  overrideBuyerReferralAction,
  createBuyerAgreementAction,
  approveBuyerAgreementAction,
  cancelBuyerAgreementAction,
  markBuyerAgreementCompletedAction,
  postBuyerProgressUpdateAction,
  createBuyerInvoiceAction,
  markBuyerInvoicePaidAction,
  voidBuyerInvoiceAction,
  type PlatformFormState,
  type ResetPasswordState,
} from "../actions";

const initialState: PlatformFormState = { status: "idle" };

type PartnerOption = { id: string; displayName: string; partnerCode: string };

export function AttributeBuyerReferralForm({ buyerId, partners }: { buyerId: string; partners: PartnerOption[] }) {
  const [state, formAction, isPending] = useActionState(attributeBuyerReferralAction, initialState);
  useActionToast(state);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="buyerId" value={buyerId} />
      <div className="w-56 space-y-1.5">
        <Label htmlFor="attribute-partnerId">Attribute to Partner</Label>
        <Select id="attribute-partnerId" name="partnerId" required defaultValue="">
          <option value="" disabled>Select Partner</option>
          {partners.map((p) => <option key={p.id} value={p.id}>{p.displayName} ({p.partnerCode})</option>)}
        </Select>
      </div>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Saving..." : "Attribute"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function OverrideBuyerReferralForm({ buyerId, partners }: { buyerId: string; partners: PartnerOption[] }) {
  const [state, formAction, isPending] = useActionState(overrideBuyerReferralAction, initialState);
  useActionToast(state);
  const [open, setOpen] = useState(false);

  if (!open) return <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>Override attribution</Button>;

  return (
    <form action={formAction} className="space-y-2 rounded-md border border-border p-3">
      <input type="hidden" name="buyerId" value={buyerId} />
      <div className="space-y-1.5">
        <Label htmlFor="override-partnerId">New Partner</Label>
        <Select id="override-partnerId" name="partnerId" required defaultValue="">
          <option value="" disabled>Select Partner</option>
          {partners.map((p) => <option key={p.id} value={p.id}>{p.displayName} ({p.partnerCode})</option>)}
        </Select>
      </div>
      <Textarea name="reason" required placeholder="Reason (required)" rows={2} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="secondary" disabled={isPending}>{isPending ? "Saving..." : "Override"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function SuspendBuyerForm({ buyerId }: { buyerId: string }) {
  const [state, formAction, isPending] = useActionState(suspendBuyerAction, initialState);
  useActionToast(state);
  const [open, setOpen] = useState(false);

  if (!open) return <Button type="button" size="sm" variant="destructive" onClick={() => setOpen(true)}>Suspend Buyer</Button>;

  return (
    <form action={formAction} className="space-y-2 rounded-md border border-border p-3">
      <input type="hidden" name="buyerId" value={buyerId} />
      <Textarea name="reason" required placeholder="Reason (required)" rows={2} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="destructive" disabled={isPending}>{isPending ? "Suspending..." : "Suspend"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}

const resetPasswordInitialState: ResetPasswordState = { status: "idle" };

/// The buyer's temporary password is only ever shown once (see
/// resetBuyerPassword's own doc comment) — this reveals a fresh one on
/// demand, so a Super Admin who lost the original from the "Convert to
/// Buyer" step (or just needs to re-share it) always has a way to get a
/// working login to send.
export function ResetBuyerPasswordButton({ buyerId }: { buyerId: string }) {
  const action = resetBuyerPasswordAction.bind(null, buyerId);
  const [state, formAction, isPending] = useActionState(action, resetPasswordInitialState);

  if (state.status === "success" && state.credentials) {
    return (
      <div className="space-y-2 rounded-md border border-success/30 bg-success-soft p-3 text-sm">
        <p className="font-medium text-foreground">New password generated — share it now, it won&apos;t be shown again:</p>
        <p className="text-muted">
          Email: <span className="font-mono text-foreground">{state.credentials.email}</span>
        </p>
        <p className="text-muted">
          Temporary password: <span className="font-mono text-foreground">{state.credentials.temporaryPassword}</span>
        </p>
        <CopyCredentialsButton email={state.credentials.email} password={state.credentials.temporaryPassword} />
      </div>
    );
  }

  return (
    <form action={formAction}>
      <Button type="submit" size="sm" variant="secondary" disabled={isPending}>
        {isPending ? "Generating..." : "Reset password / get login"}
      </Button>
      {state.status === "error" && <p className="mt-1 text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function ReactivateBuyerButton({ buyerId }: { buyerId: string }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();
  return (
    <Button size="sm" disabled={isPending} onClick={() => run(async () => { await reactivateBuyerAction(buyerId); router.refresh(); })}>
      Reactivate Buyer
    </Button>
  );
}

export function CreateBuyerAgreementForm({ buyerId, partners }: { buyerId: string; partners: PartnerOption[] }) {
  const [state, formAction, isPending] = useActionState(createBuyerAgreementAction, initialState);
  useActionToast(state);

  return (
    <form action={formAction} className="space-y-3 rounded-md border border-border p-3">
      <input type="hidden" name="buyerId" value={buyerId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="agreementValue">Agreement value (NGN)</Label>
          <Input id="agreementValue" name="agreementValue" type="number" step="0.01" min="0" placeholder="3000000" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="paymentArrangement">Payment arrangement</Label>
          <Select id="paymentArrangement" name="paymentArrangement" defaultValue="ONE_TIME">
            <option value="ONE_TIME">One-time</option>
            <option value="INSTALLMENT">Installment</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="partnerId">Partner (optional)</Label>
          <Select id="partnerId" name="partnerId" defaultValue="">
            <option value="">No Partner</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.displayName} ({p.partnerCode})</option>)}
          </Select>
        </div>
      </div>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Creating..." : "Create agreement"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function ApproveBuyerAgreementButton({ agreementId, buyerId }: { agreementId: string; buyerId: string }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();
  return (
    <Button
      size="sm"
      disabled={isPending}
      onClick={() => run(async () => { await approveBuyerAgreementAction(agreementId, buyerId); router.refresh(); })}
    >
      Approve &amp; activate
    </Button>
  );
}

export function CancelBuyerAgreementForm({ agreementId, buyerId }: { agreementId: string; buyerId: string }) {
  const [state, formAction, isPending] = useActionState(cancelBuyerAgreementAction, initialState);
  useActionToast(state);
  const [open, setOpen] = useState(false);

  if (!open) return <Button type="button" size="sm" variant="destructive" onClick={() => setOpen(true)}>Cancel agreement</Button>;

  return (
    <form action={formAction} className="space-y-2 rounded-md border border-border p-3">
      <input type="hidden" name="agreementId" value={agreementId} />
      <input type="hidden" name="buyerId" value={buyerId} />
      <Textarea name="reason" required placeholder="Reason (required)" rows={2} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="destructive" disabled={isPending}>{isPending ? "Cancelling..." : "Cancel agreement"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Back</Button>
      </div>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function CompleteBuyerAgreementButton({ agreementId, buyerId }: { agreementId: string; buyerId: string }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={isPending}
      onClick={() => run(async () => { await markBuyerAgreementCompletedAction(agreementId, buyerId); router.refresh(); })}
    >
      Mark completed
    </Button>
  );
}

const NEXT_STAGE: Record<string, string | null> = {
  ORDER_CONFIRMED: "IN_DEVELOPMENT",
  IN_DEVELOPMENT: "INSTALLATION",
  INSTALLATION: "DELIVERED",
  DELIVERED: null,
};
const STAGE_LABEL: Record<string, string> = {
  ORDER_CONFIRMED: "Order confirmed",
  IN_DEVELOPMENT: "In development",
  INSTALLATION: "Installation",
  DELIVERED: "Delivered",
};

export function PostProgressUpdateForm({ agreementId, buyerId, currentStage }: { agreementId: string; buyerId: string; currentStage: string }) {
  const [state, formAction, isPending] = useActionState(postBuyerProgressUpdateAction, initialState);
  useActionToast(state);
  const nextStage = NEXT_STAGE[currentStage];

  if (!nextStage) return <p className="text-sm text-muted">This order has reached its final stage.</p>;

  return (
    <form action={formAction} className="space-y-2 rounded-md border border-border p-3">
      <input type="hidden" name="agreementId" value={agreementId} />
      <input type="hidden" name="buyerId" value={buyerId} />
      <input type="hidden" name="stage" value={nextStage} />
      <p className="text-sm text-foreground">Advance to: <span className="font-medium">{STAGE_LABEL[nextStage]}</span></p>
      <Textarea name="note" placeholder="Note for the buyer (optional)" rows={2} />
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Posting..." : "Post update"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function CreateBuyerInvoiceForm({ agreementId, buyerId }: { agreementId: string; buyerId: string }) {
  const [state, formAction, isPending] = useActionState(createBuyerInvoiceAction, initialState);
  useActionToast(state);

  return (
    <form action={formAction} className="space-y-3 rounded-md border border-border p-3">
      <input type="hidden" name="agreementId" value={agreementId} />
      <input type="hidden" name="buyerId" value={buyerId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Input id="description" name="description" placeholder="Installment 1 of 3" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="amount">Amount (NGN)</Label>
          <Input id="amount" name="amount" type="number" step="0.01" min="0" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dueDate">Due date</Label>
          <Input id="dueDate" name="dueDate" type="date" required />
        </div>
      </div>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Creating..." : "Create invoice"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function BuyerInvoiceActions({ invoiceId, buyerId, status }: { invoiceId: string; buyerId: string; status: "PENDING" | "PAID" | "OVERDUE" | "VOID" }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();

  if (status === "PAID" || status === "VOID") return null;

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        disabled={isPending}
        onClick={() => run(async () => { await markBuyerInvoicePaidAction(invoiceId, buyerId); router.refresh(); })}
      >
        Mark paid
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={isPending}
        onClick={() => run(async () => { await voidBuyerInvoiceAction(invoiceId, buyerId); router.refresh(); })}
      >
        Void
      </Button>
    </div>
  );
}
