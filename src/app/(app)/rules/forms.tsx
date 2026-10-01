"use client";
import { useActionState } from "react";
import { Button, Card, Field, Input, Textarea, Badge } from "@/components/ui";
import { updateChecklistAction, updateRulesAction } from "@/actions/account";

interface RS { defaultRiskPercent: number; maxRiskPerTrade: number; maxDailyLossPercent: number; maxWeeklyLossPercent: number; maxTradesPerDay: number; minRiskReward: number; lowMax: number; moderateMax: number; highMax: number }

export function RulesForm({ rs, advanced }: { rs: RS; advanced: boolean }) {
  const [state, action, pending] = useActionState(updateRulesAction, {});
  const f = state.fields ?? {};
  return (
    <form action={action}>
      <Card className="p-4 md:p-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="Default risk per trade (%)" error={f.defaultRiskPercent}><Input name="defaultRiskPercent" inputMode="decimal" defaultValue={rs.defaultRiskPercent} /></Field>
          <Field label="Max risk per trade (%)" hint="Anything above this is flagged in the calculator." error={f.maxRiskPerTrade}><Input name="maxRiskPerTrade" inputMode="decimal" defaultValue={rs.maxRiskPerTrade} /></Field>
          <Field label="Max trades per day" error={f.maxTradesPerDay}><Input name="maxTradesPerDay" inputMode="numeric" defaultValue={rs.maxTradesPerDay} /></Field>
          <Field label="Max daily loss (%)" hint="When your losses today reach this share of your account, your rule says stop for the day." error={f.maxDailyLossPercent}><Input name="maxDailyLossPercent" inputMode="decimal" defaultValue={rs.maxDailyLossPercent} /></Field>
          <Field label={`Max weekly loss (%)${advanced ? "" : " · Pro"}`} error={f.maxWeeklyLossPercent}><Input name="maxWeeklyLossPercent" inputMode="decimal" defaultValue={rs.maxWeeklyLossPercent} disabled={!advanced} /></Field>
          <Field label={`Minimum risk/reward${advanced ? "" : " · Pro"}`} hint="Your personal rule, e.g. 1.5 means you only plan trades where the target is 1.5× the stop distance." error={f.minRiskReward}><Input name="minRiskReward" inputMode="decimal" defaultValue={rs.minRiskReward} disabled={!advanced} /></Field>
        </div>
        <h3 className="mb-1 mt-6 flex items-center gap-2 text-sm font-semibold">Risk levels (% of account) {!advanced && <Badge tone="accent">Pro</Badge>}</h3>
        <p className="mb-3 text-xs text-muted">The labels shown in the calculator. They describe size of risk, not whether a trade is good.</p>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Low up to" error={f.lowMax}><Input name="lowMax" inputMode="decimal" defaultValue={rs.lowMax} disabled={!advanced} /></Field>
          <Field label="Moderate up to"><Input name="moderateMax" inputMode="decimal" defaultValue={rs.moderateMax} disabled={!advanced} /></Field>
          <Field label="High up to (above = Extreme)"><Input name="highMax" inputMode="decimal" defaultValue={rs.highMax} disabled={!advanced} /></Field>
        </div>
        {!advanced && ["maxWeeklyLossPercent", "minRiskReward", "lowMax", "moderateMax", "highMax"].map((k) => <input key={k} type="hidden" name={k} value={(rs as unknown as Record<string, number>)[k]} />)}
        <div className="mt-5 flex items-center gap-3">
          <Button disabled={pending}>{pending ? "Saving…" : "Save rules"}</Button>
          {state.message && <span role="status" className="text-sm text-up">{state.message}</span>}
          {state.error && <span role="alert" className="text-sm text-down">{state.error}</span>}
        </div>
      </Card>
    </form>
  );
}

export function ChecklistForm({ items }: { items: string[] }) {
  const [state, action, pending] = useActionState(updateChecklistAction, {});
  return (
    <form action={action}>
      <Card className="p-4 md:p-5">
        <Field label="One item per line" hint="You'll see these before recording a trade. The pre-trade discipline score is the % you ticked — it tracks habits, it doesn't predict results.">
          <Textarea name="items" rows={9} defaultValue={items.join("\n")} />
        </Field>
        <div className="mt-4 flex items-center gap-3">
          <Button disabled={pending}>Save checklist</Button>
          {state.message && <span role="status" className="text-sm text-up">{state.message}</span>}
          {state.error && <span role="alert" className="text-sm text-down">{state.error}</span>}
        </div>
      </Card>
    </form>
  );
}
