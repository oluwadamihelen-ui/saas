"use client";
import { useActionState } from "react";
import { Button, Field, Input, Select } from "@/components/ui";
import { licensedBacktestAction } from "@/actions/market";
import type { ActionState } from "@/lib/validation";

type Act = (s: ActionState, fd: FormData) => Promise<ActionState>;

export function LicensedTestForm({ listingId, datasets }: { listingId: string; datasets: { id: string; name: string; symbol: string; timeframe: string; fromDate: string; toDate: string; synthetic: boolean }[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(licensedBacktestAction as Act, {});
  if (!datasets.length) return <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">Add candle data first in <a href="/lab/data" className="underline">Indicator Lab → Candle data</a>.</p>;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="listingId" value={listingId} />
      <Field label="Candle data"><Select name="datasetId">{datasets.map((d) => <option key={d.id} value={d.id}>{d.synthetic ? "⚠ SYNTHETIC · " : ""}{d.name} · {d.symbol} {d.timeframe}</option>)}</Select></Field>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Field label="From"><Input type="date" name="fromDate" /></Field><Field label="To"><Input type="date" name="toDate" /></Field><div />
        <Field label="Initial balance"><Input name="initialBalance" inputMode="decimal" defaultValue={10000} /></Field>
        <Field label="Risk per trade (%)"><Input name="riskPercent" inputMode="decimal" defaultValue={1} /></Field>
        <Field label="Pip size (optional)"><Input name="pipSize" inputMode="decimal" /></Field>
        <Field label="Spread (price units)"><Input name="spread" inputMode="decimal" defaultValue={0} /></Field>
        <Field label="Slippage (price units)"><Input name="slippage" inputMode="decimal" defaultValue={0} /></Field>
        <Field label="Commission per lot / side"><Input name="commissionPerLot" inputMode="decimal" defaultValue={0} /></Field>
      </div>
      {state.error && <p role="alert" className="text-sm text-down">{state.error}</p>}
      <Button disabled={pending}>{pending ? "Running…" : "Run test"}</Button>
    </form>
  );
}
