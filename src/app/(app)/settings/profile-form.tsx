"use client";
import { useActionState } from "react";
import { Button, Field, Input, Select } from "@/components/ui";
import { updateProfileAction } from "@/actions/account";

const TZ = [["Africa/Lagos", "Lagos (WAT)"], ["Africa/Accra", "Accra"], ["Africa/Nairobi", "Nairobi"], ["Africa/Johannesburg", "Johannesburg"], ["Europe/London", "London"], ["Asia/Dubai", "Dubai"], ["America/New_York", "New York"], ["UTC", "UTC"]];

export function ProfileForm(p: { name: string; email: string; timezone: string; currency: string }) {
  const [state, action, pending] = useActionState(updateProfileAction, {});
  return (
    <form action={action} className="space-y-4">
      <Field label="Name"><Input name="name" defaultValue={p.name} /></Field>
      <Field label="Email"><Input value={p.email} disabled readOnly /></Field>
      <Field label="Timezone" hint="Decides when your trading day and week start. Defaults to Africa/Lagos."><Select name="timezone" defaultValue={p.timezone}>{TZ.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
      <Field label="Show prices in" hint="Pricing display currency."><Select name="displayCurrency" defaultValue={p.currency}>{["USD", "NGN", "EUR", "GBP"].map((c) => <option key={c}>{c}</option>)}</Select></Field>
      {state.error && <p role="alert" className="text-sm text-down">{state.error}</p>}
      <div className="flex items-center gap-3"><Button disabled={pending}>Save</Button>{state.message && <span className="text-sm text-up">{state.message}</span>}</div>
    </form>
  );
}
