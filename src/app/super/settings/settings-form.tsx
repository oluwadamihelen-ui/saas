"use client";

import { useActionState } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updatePlatformSettingsAction, type PlatformSettingsFormState } from "./actions";

const initial: PlatformSettingsFormState = { status: "idle" };

export function PlatformSettingsForm({ settings }: { settings: Record<string, string> }) {
  const [state, formAction, isPending] = useActionState(updatePlatformSettingsAction, initial);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="supportEmail">Support email</Label>
        <Input id="supportEmail" name="supportEmail" type="email" defaultValue={settings["platform.supportEmail"]} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="trialDurationDays">Trial duration (days)</Label>
        <Input id="trialDurationDays" name="trialDurationDays" type="number" min={0} defaultValue={settings["platform.trialDurationDays"]} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="defaultCurrency">Default currency</Label>
        <Input id="defaultCurrency" name="defaultCurrency" defaultValue={settings["platform.defaultCurrency"]} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save Platform Settings"}
        </Button>
        {state.status === "success" && <span className="ml-3 text-sm text-success">{state.message}</span>}
      </div>
    </form>
  );
}
