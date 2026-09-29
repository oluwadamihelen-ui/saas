"use client";

import { useActionState, useState, useTransition } from "react";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { savePaymentProviderKeysAction, setActivePaymentProviderAction, type PaymentKeysFormState } from "./payment-actions";
import type { PaymentProviderType } from "@/generated/prisma/enums";
import type { PaymentSettingsView } from "@/lib/services/payment-settings";

const initial: PaymentKeysFormState = { status: "idle" };

function ProviderKeysForm({
  provider,
  label,
  configured,
  publicKey,
  webhookUrl,
  showWebhookSecret,
}: {
  provider: PaymentProviderType;
  label: string;
  configured: boolean;
  publicKey: string | null;
  webhookUrl: string;
  showWebhookSecret?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(savePaymentProviderKeysAction, initial);

  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <span className={`text-xs font-medium ${configured ? "text-success" : "text-muted"}`}>{configured ? "Keys on file" : "Not configured"}</span>
      </div>

      <form action={formAction} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="provider" value={provider} />
        <div className="space-y-1.5">
          <Label>Public key</Label>
          <Input name="publicKey" defaultValue={publicKey ?? ""} placeholder="pk_..." />
        </div>
        <div className="space-y-1.5">
          <Label>Secret key {configured && <span className="text-muted">(leave blank to keep current)</span>}</Label>
          <Input name="secretKey" type="password" placeholder={configured ? "••••••••••••" : "sk_..."} />
        </div>
        {showWebhookSecret && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Webhook secret hash (set in your Flutterwave dashboard under Settings → Webhooks)</Label>
            <Input name="webhookSecret" type="password" placeholder="Leave blank to keep current" />
          </div>
        )}
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Webhook URL (paste this into {label}&apos;s dashboard)</Label>
          <Input readOnly value={webhookUrl} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" size="sm" variant="secondary" disabled={isPending}>
            {isPending ? "Saving..." : `Save ${label} keys`}
          </Button>
          {state.status !== "idle" && <span className={`ml-3 text-xs ${state.status === "success" ? "text-success" : "text-danger"}`}>{state.message}</span>}
        </div>
      </form>
    </div>
  );
}

export function PaymentProcessorSettings({ settings, appUrl }: { settings: PaymentSettingsView; appUrl: string }) {
  const [isPending, startTransition] = useTransition();
  const [active, setActive] = useState<PaymentProviderType | "NONE">(settings.activeProvider ?? "NONE");
  const [error, setError] = useState<string | null>(null);

  function handleActiveChange(value: PaymentProviderType | "NONE") {
    setError(null);
    startTransition(async () => {
      const result = await setActivePaymentProviderAction(value);
      if (result.status === "success") {
        setActive(value);
      } else {
        setError(result.message ?? "Unable to update active provider.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>Active online payment provider</Label>
            <Select value={active} disabled={isPending} onChange={(e) => handleActiveChange(e.target.value as PaymentProviderType | "NONE")} className="w-56">
              <option value="NONE">None (online payments off)</option>
              <option value="PAYSTACK">Paystack</option>
              <option value="FLUTTERWAVE">Flutterwave</option>
              <option value="KORAPAY">Kora Pay</option>
            </Select>
          </div>
          <p className="max-w-md text-xs text-muted">
            Only the active provider is used when staff send a guest an online payment link. Save a provider&apos;s
            keys below before selecting it here.
          </p>
        </CardContent>
        {error && (
          <CardContent className="pt-0">
            <p className="text-xs text-danger">{error}</p>
          </CardContent>
        )}
      </Card>

      <ProviderKeysForm provider="PAYSTACK" label="Paystack" configured={settings.paystack.configured} publicKey={settings.paystack.publicKey} webhookUrl={`${appUrl}/api/webhooks/paystack`} />
      <ProviderKeysForm
        provider="FLUTTERWAVE"
        label="Flutterwave"
        configured={settings.flutterwave.configured}
        publicKey={settings.flutterwave.publicKey}
        webhookUrl={`${appUrl}/api/webhooks/flutterwave`}
        showWebhookSecret
      />
      <ProviderKeysForm provider="KORAPAY" label="Kora Pay" configured={settings.korapay.configured} publicKey={settings.korapay.publicKey} webhookUrl={`${appUrl}/api/webhooks/korapay`} />
    </div>
  );
}
