"use client";

import { useActionState } from "react";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  setActiveEmailProviderAction,
  setActiveSmsProviderAction,
  type NotificationProviderFormState,
} from "./notification-provider-actions";
import type { NotificationDeliveryProvider } from "@/generated/prisma/client";

import { useActionToast } from "@/hooks/use-action-toast";

const initialState: NotificationProviderFormState = { status: "idle" };

const PROVIDER_LABELS: Record<NotificationDeliveryProvider, string> = {
  RESEND: "Resend",
  TWILIO: "Twilio",
  SENTDM: "Sent.dm",
};

export function ActiveEmailProviderForm({
  currentProvider,
  connectedProviders,
}: {
  currentProvider: NotificationDeliveryProvider | null;
  connectedProviders: NotificationDeliveryProvider[];
}) {
  const [state, formAction, isPending] = useActionState(setActiveEmailProviderAction, initialState);
  useActionToast(state);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="w-72 space-y-1.5">
        <Label htmlFor="activeEmailProvider">Provider used for email notifications</Label>
        <Select id="activeEmailProvider" name="activeProvider" defaultValue={currentProvider ?? ""}>
          <option value="">None — email notifications off</option>
          {connectedProviders.map((p) => (
            <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
          ))}
        </Select>
      </div>
      <Button type="submit" variant="secondary" disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
      {state.status === "success" && <p className="text-sm text-success">{state.message}</p>}
    </form>
  );
}

export function ActiveSmsProviderForm({
  currentProvider,
  connectedProviders,
}: {
  currentProvider: NotificationDeliveryProvider | null;
  connectedProviders: NotificationDeliveryProvider[];
}) {
  const [state, formAction, isPending] = useActionState(setActiveSmsProviderAction, initialState);
  useActionToast(state);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="w-72 space-y-1.5">
        <Label htmlFor="activeSmsProvider">Provider used for SMS notifications</Label>
        <Select id="activeSmsProvider" name="activeProvider" defaultValue={currentProvider ?? ""}>
          <option value="">None — SMS notifications off</option>
          {connectedProviders.map((p) => (
            <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
          ))}
        </Select>
      </div>
      <Button type="submit" variant="secondary" disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
      {state.status === "success" && <p className="text-sm text-success">{state.message}</p>}
    </form>
  );
}
