"use client";
import { useActionState, useState } from "react";
import { Button, Card, Field, Input, Select, Textarea, Badge } from "@/components/ui";
import { RULE_TEMPLATES, type RuleTemplate } from "@/lib/engine/challenge";
import { updateChecklistAction, updateRulesAction } from "@/actions/account";

interface RS { defaultRiskPercent: number; maxRiskPerTrade: number; maxDailyLossPercent: number; maxWeeklyLossPercent: number; maxTradesPerDay: number; minRiskReward: number; lowMax: number; moderateMax: number; highMax: number; ruleTemplate: string | null; maxTotalDrawdownPercent: number | null; drawdownType: string; profitTargetPercent: number | null }

const NUM_KEYS = ["defaultRiskPercent", "maxRiskPerTrade", "maxDailyLossPercent", "maxWeeklyLossPercent", "maxTradesPerDay", "minRiskReward", "lowMax", "moderateMax", "highMax"] as const;

export function RulesForm({ rs, advanced }: { rs: RS; advanced: boolean }) {
  const [state, action, pending] = useActionState(updateRulesAction, {});
  const f = state.fields ?? {};
  const [v, setV] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(NUM_KEYS.map((k) => [k, String(rs[k])])),
    maxTotalDrawdownPercent: rs.maxTotalDrawdownPercent === null ? "" : String(rs.maxTotalDrawdownPercent),
    profitTargetPercent: rs.profitTargetPercent === null ? "" : String(rs.profitTargetPercent),
    drawdownType: rs.drawdownType,
    ruleTemplate: rs.ruleTemplate ?? "",
  }));
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value, ...(k !== "drawdownType" && k.startsWith("max") || k === "profitTargetPercent" ? { ruleTemplate: "" } : {}) });

  function apply(t: RuleTemplate) {
    setV({
      ...v,
      defaultRiskPercent: String(t.rules.defaultRiskPercent), maxRiskPerTrade: String(t.rules.maxRiskPerTrade), maxDailyLossPercent: String(t.rules.maxDailyLossPercent),
      maxWeeklyLossPercent: String(t.rules.maxWeeklyLossPercent), maxTradesPerDay: String(t.rules.maxTradesPerDay), minRiskReward: String(t.rules.minRiskReward),
      maxTotalDrawdownPercent: t.rules.maxTotalDrawdownPercent === null ? "" : String(t.rules.maxTotalDrawdownPercent),
      drawdownType: t.rules.drawdownType, profitTargetPercent: t.rules.profitTargetPercent === null ? "" : String(t.rules.profitTargetPercent), ruleTemplate: t.key,
    });
  }

  const dis = !advanced;
  return (
    <form action={action}>
      <input type="hidden" name="ruleTemplate" value={v.ruleTemplate} />
      {advanced && (
        <Card className="mb-5 p-4 md:p-5">
          <h3 className="text-sm font-semibold">Start from a template</h3>
          <p className="mb-3 mt-1 text-xs text-muted">Common prop-firm and personal setups. They only fill in the boxes below — you can edit every number. Firms change their rules and measure drawdown differently, so always check your firm&apos;s current terms.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {RULE_TEMPLATES.map((t) => (
              <button key={t.key} type="button" onClick={() => apply(t)} className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${v.ruleTemplate === t.key ? "border-accent bg-accent-soft" : "border-line hover:border-muted/60"}`}>
                <span className="font-medium">{t.name}</span><span className="mt-0.5 block text-xs text-muted">{t.description}</span>
              </button>
            ))}
          </div>
        </Card>
      )}
      <Card className="p-4 md:p-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="Default risk per trade (%)" error={f.defaultRiskPercent}><Input name="defaultRiskPercent" inputMode="decimal" value={v.defaultRiskPercent} onChange={set("defaultRiskPercent")} /></Field>
          <Field label="Max risk per trade (%)" hint="Anything above this is flagged in the calculator." error={f.maxRiskPerTrade}><Input name="maxRiskPerTrade" inputMode="decimal" value={v.maxRiskPerTrade} onChange={set("maxRiskPerTrade")} /></Field>
          <Field label="Max trades per day" error={f.maxTradesPerDay}><Input name="maxTradesPerDay" inputMode="numeric" value={v.maxTradesPerDay} onChange={set("maxTradesPerDay")} /></Field>
          <Field label="Max daily loss (%)" hint="When your losses today reach this share of your account, your rule says stop for the day." error={f.maxDailyLossPercent}><Input name="maxDailyLossPercent" inputMode="decimal" value={v.maxDailyLossPercent} onChange={set("maxDailyLossPercent")} /></Field>
          <Field label={`Max weekly loss (%)${advanced ? "" : " · Pro"}`} error={f.maxWeeklyLossPercent}><Input name="maxWeeklyLossPercent" inputMode="decimal" value={v.maxWeeklyLossPercent} onChange={set("maxWeeklyLossPercent")} disabled={dis} /></Field>
          <Field label={`Minimum risk/reward${advanced ? "" : " · Pro"}`} hint="Your personal rule, e.g. 1.5 means you only plan trades where the target is 1.5× the stop distance." error={f.minRiskReward}><Input name="minRiskReward" inputMode="decimal" value={v.minRiskReward} onChange={set("minRiskReward")} disabled={dis} /></Field>
        </div>

        <h3 className="mb-1 mt-6 flex items-center gap-2 text-sm font-semibold">Challenge / prop-firm limits {!advanced && <Badge tone="accent">Pro</Badge>}</h3>
        <p className="mb-3 text-xs text-muted">Optional. Tracked from your closed trades. Leave blank if you don&apos;t have a max-drawdown or profit-target rule.</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="Max total drawdown (%)" hint="The most your account can fall in total before your rule says stop." error={f.maxTotalDrawdownPercent}><Input name="maxTotalDrawdownPercent" inputMode="decimal" value={v.maxTotalDrawdownPercent} onChange={set("maxTotalDrawdownPercent")} disabled={dis} placeholder="none" /></Field>
          <Field label="Drawdown type" hint="Fixed: measured from your starting balance. Trailing: measured from your highest balance so far."><Select name="drawdownType" value={v.drawdownType} onChange={set("drawdownType")} disabled={dis}><option value="STATIC">Fixed (from start)</option><option value="TRAILING">Trailing (from peak)</option></Select></Field>
          <Field label="Profit target (%)" error={f.profitTargetPercent}><Input name="profitTargetPercent" inputMode="decimal" value={v.profitTargetPercent} onChange={set("profitTargetPercent")} disabled={dis} placeholder="none" /></Field>
        </div>

        <h3 className="mb-1 mt-6 flex items-center gap-2 text-sm font-semibold">Risk levels (% of account) {!advanced && <Badge tone="accent">Pro</Badge>}</h3>
        <p className="mb-3 text-xs text-muted">The labels shown in the calculator. They describe size of risk, not whether a trade is good.</p>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Low up to" error={f.lowMax}><Input name="lowMax" inputMode="decimal" value={v.lowMax} onChange={set("lowMax")} disabled={dis} /></Field>
          <Field label="Moderate up to"><Input name="moderateMax" inputMode="decimal" value={v.moderateMax} onChange={set("moderateMax")} disabled={dis} /></Field>
          <Field label="High up to (above = Extreme)"><Input name="highMax" inputMode="decimal" value={v.highMax} onChange={set("highMax")} disabled={dis} /></Field>
        </div>
        {dis && ["maxWeeklyLossPercent", "minRiskReward", "lowMax", "moderateMax", "highMax", "maxTotalDrawdownPercent", "profitTargetPercent", "drawdownType"].map((k) => <input key={k} type="hidden" name={k} value={v[k]} />)}
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
