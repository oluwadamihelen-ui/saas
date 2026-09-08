"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { saveGatewayCredentialAction, removeGatewayCredentialAction, type GatewayFormState } from "./payment-gateway-actions";
import type { PaymentGatewayProvider } from "@/generated/prisma/client";

const initialState: GatewayFormState = { status: "idle" };

const PROVIDER_LABELS: Record<PaymentGatewayProvider, string> = {
  PAYSTACK: "Paystack",
  FLUTTERWAVE: "Flutterwave",
  KORAPAY: "Korapay",
};

export function GatewayForm({
  provider,
  connected,
}: {
  provider: PaymentGatewayProvider;
  connected?: { publicKey: string; isEnabled: boolean; hasWebhookSecret: boolean } | null;
}) {
  const [state, formAction, isPending] = useActionState(saveGatewayCredentialAction, initialState);

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
            <Label htmlFor={`${provider}-publicKey`}>Public key</Label>
            <Input id={`${provider}-publicKey`} name="publicKey" required defaultValue={connected?.publicKey ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${provider}-secretKey`}>Secret key</Label>
            <Input
              id={`${provider}-secretKey`}
              name="secretKey"
              type="password"
              autoComplete="off"
              placeholder={connected ? "Leave blank to keep existing" : "sk_..."}
            />
          </div>
        </div>
        {provider === "FLUTTERWAVE" && (
          <div className="space-y-1.5">
            <Label htmlFor="webhookSecret">Webhook secret hash (optional)</Label>
            <Input
              id="webhookSecret"
              name="webhookSecret"
              type="password"
              autoComplete="off"
              placeholder={connected?.hasWebhookSecret ? "Leave blank to keep existing" : "From Flutterwave's webhook settings"}
            />
            <p className="text-xs text-muted">Needed only if you want Flutterwave to confirm payments by webhook, not just on redirect back.</p>
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

function DisconnectButton({ provider }: { provider: PaymentGatewayProvider }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await removeGatewayCredentialAction(provider);
          router.refresh();
        })
      }
    >
      {isPending ? "Disconnecting..." : "Disconnect"}
    </Button>
  );
}
