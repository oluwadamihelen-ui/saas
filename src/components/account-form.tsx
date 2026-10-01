"use client";
import { useActionState } from "react";
import { Button, Field, Input, Select } from "@/components/ui";
import { createAccountAction, updateAccountAction } from "@/actions/account";
import { CURRENCIES } from "@/lib/engine/instruments";

interface A { id?: string; name?: string; currency?: string; startingBalance?: number; broker?: string; platform?: string; instruments?: string[] }

export function AccountForm({ account, submitLabel }: { account?: A; submitLabel: string }) {
  const [state, action, pending] = useActionState(account?.id ? updateAccountAction : createAccountAction, {});
  const f = state.fields ?? {};
  return (
    <form action={action} className="space-y-4">
      {account?.id && <input type="hidden" name="id" value={account.id} />}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Account name" error={f.name} className="col-span-2 sm:col-span-1"><Input name="name" defaultValue={account?.name} placeholder="e.g. Exness, FTMO, Deriv" required /></Field>
        <Field label="Broker / platform" className="col-span-2 sm:col-span-1"><Input name="broker" defaultValue={account?.broker} placeholder="Broker name" /></Field>
        <Field label="Currency" hint="The currency of this trading account."><Select name="currency" defaultValue={account?.currency ?? "USD"}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Starting balance" error={f.startingBalance}><Input name="startingBalance" inputMode="decimal" defaultValue={account?.startingBalance} required /></Field>
        <Field label="Platform"><Select name="platform" defaultValue={account?.platform ?? "MT5"}>{["MT5", "MT4", "TradingView", "cTrader", "Binance", "Other"].map((p) => <option key={p}>{p}</option>)}</Select></Field>
        <Field label="Instruments you trade" hint="Symbols separated by commas."><Input name="instruments" defaultValue={account?.instruments?.join(", ") ?? "XAUUSD, BTCUSD"} /></Field>
      </div>
      {state.error && <p role="alert" className="text-sm text-down">{state.error}</p>}
      <div className="flex items-center gap-3"><Button disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>{state.message && <span className="text-sm text-up">{state.message}</span>}</div>
    </form>
  );
}
