"use client";

import { useActionState } from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  updateSchoolStatusAction,
  changeSchoolPlanAction,
  createSubscriptionAction,
  updateSubscriptionStatusAction,
  generatePlatformInvoiceAction,
  markPlatformInvoicePaidAction,
  voidPlatformInvoiceAction,
  type PlatformFormState,
} from "../actions";

const initialState: PlatformFormState = { status: "idle" };

export function SchoolStatusForm({ schoolId, currentStatus }: { schoolId: string; currentStatus: "TRIAL" | "ACTIVE" | "SUSPENDED" }) {
  const [state, formAction, isPending] = useActionState(updateSchoolStatusAction, initialState);

  return (
    <form action={formAction} className="flex items-end gap-3">
      <input type="hidden" name="schoolId" value={schoolId} />
      <div className="w-40 space-y-1.5">
        <Select name="status" defaultValue={currentStatus}>
          <option value="TRIAL">Trial</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </Select>
      </div>
      <Button type="submit" size="sm" variant="secondary" disabled={isPending}>{isPending ? "Saving..." : "Update status"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function CreateSubscriptionForm({ schoolId, plans }: { schoolId: string; plans: { id: string; name: string }[] }) {
  const [state, formAction, isPending] = useActionState(createSubscriptionAction, initialState);

  return (
    <form action={formAction} className="flex items-end gap-3">
      <input type="hidden" name="schoolId" value={schoolId} />
      <div className="w-48 space-y-1.5">
        <Select name="planId" required defaultValue="">
          <option value="" disabled>Select plan</option>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </div>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Creating..." : "Start subscription"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function PlanChangeForm({
  schoolId,
  currentPlanId,
  plans,
}: {
  schoolId: string;
  currentPlanId: string;
  plans: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(changeSchoolPlanAction, initialState);

  return (
    <form action={formAction} className="flex items-end gap-3">
      <input type="hidden" name="schoolId" value={schoolId} />
      <div className="w-48 space-y-1.5">
        <Select name="planId" defaultValue={currentPlanId}>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </div>
      <Button type="submit" size="sm" variant="secondary" disabled={isPending}>{isPending ? "Saving..." : "Change plan"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function SubscriptionStatusForm({
  schoolId,
  currentStatus,
}: {
  schoolId: string;
  currentStatus: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED" | "SUSPENDED";
}) {
  const [state, formAction, isPending] = useActionState(updateSubscriptionStatusAction, initialState);

  return (
    <form action={formAction} className="flex items-end gap-3">
      <input type="hidden" name="schoolId" value={schoolId} />
      <div className="w-40 space-y-1.5">
        <Select name="status" defaultValue={currentStatus}>
          <option value="TRIALING">Trialing</option>
          <option value="ACTIVE">Active</option>
          <option value="PAST_DUE">Past due</option>
          <option value="CANCELED">Canceled</option>
          <option value="EXPIRED">Expired</option>
          <option value="SUSPENDED">Suspended</option>
        </Select>
      </div>
      <Button type="submit" size="sm" variant="secondary" disabled={isPending}>{isPending ? "Saving..." : "Update subscription"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function GenerateInvoiceButton({ schoolId }: { schoolId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await generatePlatformInvoiceAction(schoolId);
          router.refresh();
        })
      }
    >
      Generate invoice for current period
    </Button>
  );
}

export function InvoiceActions({ invoiceId, schoolId, status }: { invoiceId: string; schoolId: string; status: "PENDING" | "PAID" | "OVERDUE" | "VOID" }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (status === "PAID" || status === "VOID") return null;

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await markPlatformInvoicePaidAction(invoiceId, schoolId);
            router.refresh();
          })
        }
      >
        Mark paid
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await voidPlatformInvoiceAction(invoiceId, schoolId);
            router.refresh();
          })
        }
      >
        Void
      </Button>
    </div>
  );
}
