"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import { useSafeAction } from "@/hooks/use-safe-action";
import {
  attributePartnerReferralAction,
  overridePartnerReferralAction,
  createCommercialAgreementAction,
  approveCommercialAgreementAction,
  cancelCommercialAgreementAction,
  markCommercialAgreementCompletedAction,
  type PlatformFormState,
} from "../../partners/actions";

const initialState: PlatformFormState = { status: "idle" };

type PartnerOption = { id: string; displayName: string; partnerCode: string };

export function AttributeReferralForm({ schoolId, partners }: { schoolId: string; partners: PartnerOption[] }) {
  const [state, formAction, isPending] = useActionState(attributePartnerReferralAction, initialState);
  useActionToast(state);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="schoolId" value={schoolId} />
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

export function OverrideReferralForm({ schoolId, partners }: { schoolId: string; partners: PartnerOption[] }) {
  const [state, formAction, isPending] = useActionState(overridePartnerReferralAction, initialState);
  useActionToast(state);
  const [open, setOpen] = useState(false);

  if (!open) return <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>Override attribution</Button>;

  return (
    <form action={formAction} className="space-y-2 rounded-md border border-border p-3">
      <input type="hidden" name="schoolId" value={schoolId} />
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

export function CreateAgreementForm({
  schoolId,
  partners,
  subscriptionId,
}: {
  schoolId: string;
  partners: PartnerOption[];
  subscriptionId: string | null;
}) {
  const [state, formAction, isPending] = useActionState(createCommercialAgreementAction, initialState);
  useActionToast(state);
  const [mode, setMode] = useState<"BUY" | "RENT">("BUY");

  return (
    <form action={formAction} className="space-y-3 rounded-md border border-border p-3">
      <input type="hidden" name="schoolId" value={schoolId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="commercialMode">Mode</Label>
          <Select id="commercialMode" name="commercialMode" value={mode} onChange={(e) => setMode(e.target.value as "BUY" | "RENT")}>
            <option value="BUY">BUY (outright purchase)</option>
            <option value="RENT">RENT (subscription)</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="partnerId">Partner (optional)</Label>
          <Select id="partnerId" name="partnerId" defaultValue="">
            <option value="">No Partner</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.displayName} ({p.partnerCode})</option>)}
          </Select>
        </div>
        {mode === "RENT" && (
          <input type="hidden" name="subscriptionId" value={subscriptionId ?? ""} />
        )}
        {mode === "BUY" && (
          <>
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
          </>
        )}
      </div>
      {mode === "RENT" && !subscriptionId && (
        <p className="text-sm text-danger">This school has no Subscription yet — create one first before adding a RENT agreement.</p>
      )}
      <Button type="submit" size="sm" disabled={isPending || (mode === "RENT" && !subscriptionId)}>
        {isPending ? "Creating..." : "Create agreement"}
      </Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function ApproveAgreementForm({ agreementId, schoolId }: { agreementId: string; schoolId: string }) {
  const [state, formAction, isPending] = useActionState(approveCommercialAgreementAction, initialState);
  useActionToast(state);

  return (
    <form action={formAction} className="space-y-2 rounded-md border border-border p-3">
      <input type="hidden" name="agreementId" value={agreementId} />
      <input type="hidden" name="schoolId" value={schoolId} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="stopRentSubscription" defaultChecked />
        Stop the RENT subscription, if this school has one active (only applies to a BUY agreement)
      </label>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Approving..." : "Approve & activate"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function CancelAgreementForm({ agreementId, schoolId }: { agreementId: string; schoolId: string }) {
  const [state, formAction, isPending] = useActionState(cancelCommercialAgreementAction, initialState);
  useActionToast(state);
  const [open, setOpen] = useState(false);

  if (!open) return <Button type="button" size="sm" variant="destructive" onClick={() => setOpen(true)}>Cancel agreement</Button>;

  return (
    <form action={formAction} className="space-y-2 rounded-md border border-border p-3">
      <input type="hidden" name="agreementId" value={agreementId} />
      <input type="hidden" name="schoolId" value={schoolId} />
      <Textarea name="reason" required placeholder="Reason (required)" rows={2} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="destructive" disabled={isPending}>{isPending ? "Cancelling..." : "Cancel agreement"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Back</Button>
      </div>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function CompleteAgreementButton({ agreementId, schoolId }: { agreementId: string; schoolId: string }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();

  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={isPending}
      onClick={() => run(async () => { await markCommercialAgreementCompletedAction(agreementId, schoolId); router.refresh(); })}
    >
      Mark completed
    </Button>
  );
}
