"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  saveNotificationProviderCredentialAction,
  removeNotificationProviderCredentialAction,
  type NotificationProviderFormState,
} from "./notification-provider-actions";
import type { NotificationDeliveryProvider } from "@/generated/prisma/client";

import { useActionToast } from "@/hooks/use-action-toast";
import { useSafeAction } from "@/hooks/use-safe-action";

const initialState: NotificationProviderFormState = { status: "idle" };

const PROVIDER_LABELS: Record<NotificationDeliveryProvider, string> = {
  RESEND: "Resend",
  TWILIO: "Twilio",
  SENTDM: "Sent.dm",
};

const FROM_IDENTIFIER_LABEL: Record<NotificationDeliveryProvider, string> = {
  RESEND: "From email",
  TWILIO: "From phone number",
  SENTDM: "From phone number / sender ID",
};

const FROM_IDENTIFIER_PLACEHOLDER: Record<NotificationDeliveryProvider, string> = {
  RESEND: "notifications@yourschool.com",
  TWILIO: "+15551234567",
  SENTDM: "+2348012345678",
};

const API_KEY_LABEL: Record<NotificationDeliveryProvider, string> = {
  RESEND: "API key",
  TWILIO: "Auth token",
  SENTDM: "API key",
};

export function NotificationProviderForm({
  provider,
  connected,
}: {
  provider: NotificationDeliveryProvider;
  connected?: { fromIdentifier: string; isEnabled: boolean; hasAccountSid: boolean } | null;
}) {
  const [state, formAction, isPending] = useActionState(saveNotificationProviderCredentialAction, initialState);
  useActionToast(state);

  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <div className="flex items-center justify-between">
        <p className="font-medium text-foreground">{PROVIDER_LABELS[provider]}</p>
        <Badge variant={connected ? (connected.isEnabled ? "success" : "neutral") : "neutral"}>
          {connected ? (connected.isEnabled ? "Connected" : "Connected (disabled)") : "Not connected"}
        </Badge>
      </div>
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="provider" value={provider} />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${provider}-fromIdentifier`}>{FROM_IDENTIFIER_LABEL[provider]}</Label>
            <Input
              id={`${provider}-fromIdentifier`}
              name="fromIdentifier"
              required
              placeholder={FROM_IDENTIFIER_PLACEHOLDER[provider]}
              defaultValue={connected?.fromIdentifier ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${provider}-apiKey`}>{API_KEY_LABEL[provider]}</Label>
            <Input
              id={`${provider}-apiKey`}
              name="apiKey"
              type="password"
              autoComplete="off"
              placeholder={connected ? "Leave blank to keep existing" : undefined}
            />
          </div>
        </div>
        {provider === "TWILIO" && (
          <div className="space-y-1.5">
            <Label htmlFor="accountSid">Account SID</Label>
            <Input
              id="accountSid"
              name="accountSid"
              autoComplete="off"
              placeholder={connected?.hasAccountSid ? "Leave blank to keep existing" : "AC..."}
            />
          </div>
        )}
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" name="isEnabled" defaultChecked={connected?.isEnabled ?? true} className="h-4 w-4 rounded border-border" />
          Enabled
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Saving..." : connected ? "Update" : "Connect"}
          </Button>
          {connected && <DisconnectButton provider={provider} />}
        </div>
        {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
        {state.status === "success" && <p className="text-sm text-success">{state.message}</p>}
      </form>
    </div>
  );
}

function DisconnectButton({ provider }: { provider: NotificationDeliveryProvider }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={isPending}
      onClick={() =>
        run(async () => {
          await removeNotificationProviderCredentialAction(provider);
          router.refresh();
        })
      }
    >
      {isPending ? "Disconnecting..." : "Disconnect"}
    </Button>
  );
}
