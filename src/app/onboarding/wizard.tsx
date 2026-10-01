"use client";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button, Card, Disclaimer, Field, Input, Progress, Select } from "@/components/ui";
import { onboardingAction } from "@/actions/account";
import { Calculator } from "@/components/calc/calculator";
import { CURRENCIES } from "@/lib/engine/instruments";

const STEPS = ["Account", "Balance", "Currency", "Default risk", "Loss limits", "First trade", "Ready"];

export function Wizard() {
  const router = useRouter();
  const [stepRaw, setStep] = useState(0);
  const [v, setV] = useState({ name: "", broker: "", platform: "MT5", instruments: "XAUUSD, BTCUSD", startingBalance: "1000", currency: "USD", defaultRiskPercent: "1", maxRiskPerTrade: "1", maxDailyLossPercent: "3", maxWeeklyLossPercent: "6", maxTradesPerDay: "5" });
  const [state, action, pending] = useActionState(onboardingAction, {});
  const f = state.fields ?? {};
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  // Once the account is saved, jump to the "first trade" step.
  const step = state.ok && stepRaw < 5 ? 5 : stepRaw;

  const canNext = [v.name.trim().length > 0, Number(v.startingBalance) > 0, true, Number(v.defaultRiskPercent) > 0 && Number(v.defaultRiskPercent) <= 100, true][step] ?? true;
  const hasError = Object.keys(f).length > 0;

  return (
    <div>
      <div className="mb-6">
        <div className="mb-2 flex justify-between text-xs text-muted"><span>Step {Math.min(step + 1, 7)} of 7 · {STEPS[step]}</span></div>
        <Progress value={((step + 1) / 7) * 100} tone="up" />
      </div>

      {step < 5 && (
        <form action={action}>
          {Object.entries(v).map(([k, val]) => <input key={k} type="hidden" name={k} value={val} />)}
          <input type="hidden" name="minRiskReward" value="1.5" /><input type="hidden" name="lowMax" value="1" /><input type="hidden" name="moderateMax" value="2" /><input type="hidden" name="highMax" value="5" />
          <Card className="space-y-5 p-6">
            {step === 0 && (<>
              <div><h1 className="text-xl font-semibold">Let&apos;s set up your first trading account</h1><p className="mt-1 text-sm text-muted">Takes about a minute. You can change everything later.</p></div>
              <Field label="Account name" error={f.name}><Input autoFocus value={v.name} onChange={set("name")} placeholder="e.g. Exness, FTMO, Deriv" /></Field>
              <Field label="Broker"><Input value={v.broker} onChange={set("broker")} placeholder="Optional" /></Field>
              <Field label="Platform"><Select value={v.platform} onChange={set("platform")}>{["MT5", "MT4", "TradingView", "cTrader", "Binance", "Other"].map((p) => <option key={p}>{p}</option>)}</Select></Field>
              <Field label="What do you trade?" hint="Symbols separated by commas."><Input value={v.instruments} onChange={set("instruments")} /></Field>
            </>)}
            {step === 1 && (<>
              <div><h1 className="text-xl font-semibold">What is your account balance?</h1><p className="mt-1 text-sm text-muted">Your risk limits are worked out from this.</p></div>
              <Field label="Starting balance" error={f.startingBalance}><Input autoFocus inputMode="decimal" value={v.startingBalance} onChange={set("startingBalance")} /></Field>
            </>)}
            {step === 2 && (<>
              <div><h1 className="text-xl font-semibold">Which currency is the account in?</h1></div>
              <div className="grid grid-cols-2 gap-3">{CURRENCIES.map((c) => <button type="button" key={c} onClick={() => setV({ ...v, currency: c })} className={`rounded-lg border px-4 py-3 text-left font-medium ${v.currency === c ? "border-accent bg-accent-soft" : "border-line"}`}>{c}</button>)}</div>
            </>)}
            {step === 3 && (<>
              <div><h1 className="text-xl font-semibold">How much do you usually risk per trade?</h1><p className="mt-1 text-sm text-muted">As a % of your account. Many traders keep this at 1% or less — it&apos;s your choice.</p></div>
              <Field label="Default risk per trade (%)" error={f.defaultRiskPercent}><Input autoFocus inputMode="decimal" value={v.defaultRiskPercent} onChange={(e) => setV({ ...v, defaultRiskPercent: e.target.value, maxRiskPerTrade: Number(e.target.value) > Number(v.maxRiskPerTrade) ? e.target.value : v.maxRiskPerTrade })} /></Field>
              <Field label="Never risk more than (%)" hint="Your own ceiling. The calculator warns you above it." error={f.maxRiskPerTrade}><Input inputMode="decimal" value={v.maxRiskPerTrade} onChange={set("maxRiskPerTrade")} /></Field>
            </>)}
            {step === 4 && (<>
              <div><h1 className="text-xl font-semibold">Set your loss limits</h1><p className="mt-1 text-sm text-muted">When you reach them, RiskPilot reminds you of your own rule to stop. It can&apos;t block your broker.</p></div>
              <Field label="Max daily loss (%)" error={f.maxDailyLossPercent}><Input inputMode="decimal" value={v.maxDailyLossPercent} onChange={set("maxDailyLossPercent")} /></Field>
              <Field label="Max weekly loss (%)" error={f.maxWeeklyLossPercent}><Input inputMode="decimal" value={v.maxWeeklyLossPercent} onChange={set("maxWeeklyLossPercent")} /></Field>
              <Field label="Max trades per day" error={f.maxTradesPerDay}><Input inputMode="numeric" value={v.maxTradesPerDay} onChange={set("maxTradesPerDay")} /></Field>
              {state.error && <p role="alert" className="text-sm text-down">{state.error}</p>}
              {hasError && <p role="alert" className="text-sm text-down">Please check: {Object.values(f).join(" · ")}</p>}
            </>)}
            <div className="flex justify-between">
              <Button type="button" variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>Back</Button>
              {step < 4 ? <Button key="next" type="button" onClick={() => canNext && setStep(step + 1)} disabled={!canNext}>Continue</Button> : <Button key="submit" type="submit" disabled={pending}>{pending ? "Saving…" : "Save & calculate my first trade"}</Button>}
            </div>
          </Card>
        </form>
      )}

      {step === 5 && (
        <div className="space-y-4">
          <div><h1 className="text-xl font-semibold">Calculate your first trade</h1><p className="mt-1 text-sm text-muted">Enter an entry and stop loss from any chart. This is just a practice run — nothing is recorded.</p></div>
          <Calculator mode="size" currency={v.currency} initial={{ balance: Number(v.startingBalance), riskPercent: Number(v.defaultRiskPercent), entry: "2650", stop: "2640" }} maxRiskPerTrade={Number(v.maxRiskPerTrade)} />
          <div className="flex justify-end"><Button size="lg" onClick={() => setStep(6)}>Finish</Button></div>
        </div>
      )}

      {step === 6 && (
        <Card className="p-8 text-center">
          <CheckCircle2 className="mx-auto text-up" size={44} />
          <h1 className="mt-4 text-2xl font-semibold">Your risk setup is ready.</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">Risk {v.defaultRiskPercent}% per trade · stop for the day at {v.maxDailyLossPercent}% loss · max {v.maxTradesPerDay} trades a day.</p>
          <Button size="lg" className="mt-6" onClick={() => { router.push("/dashboard"); router.refresh(); }}>Go to my dashboard</Button>
          <div className="mt-6"><Disclaimer compact /></div>
        </Card>
      )}
    </div>
  );
}
