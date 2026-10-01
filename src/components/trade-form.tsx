"use client";
import { useActionState, useMemo, useState } from "react";
import { Badge, Button, Card, Disclaimer, Field, Hint, Input, Select, Textarea } from "@/components/ui";
import { createTradeAction, updateTradeAction } from "@/actions/trade";
import { DEFAULT_USD_RATES, presetFor } from "@/lib/engine/instruments";
import { computeRisk } from "@/lib/engine/risk";
import { disciplineScore } from "@/lib/engine/guardrail";
import { cn } from "@/lib/utils";

export interface TradeDefaults {
  id?: string;
  openedAt?: string; // ISO
  instrument?: string;
  direction?: "LONG" | "SHORT";
  entryPrice?: string;
  stopLoss?: string;
  takeProfit?: string;
  exitPrice?: string;
  lots?: string;
  riskAmount?: string;
  pnl?: string;
  setup?: string;
  session?: string;
  reasonEntry?: string;
  reasonExit?: string;
  emotionBefore?: string;
  emotionAfter?: string;
  notes?: string;
  tags?: string;
  checklistScore?: string;
}

export const EMOTIONS = ["Calm", "Confident", "Focused", "Neutral", "Anxious", "Excited", "Fearful", "Frustrated", "Greedy", "Bored", "Revenge"];
const SESSIONS = ["Asia", "London", "New York", "Off-hours"];
const SETUPS = ["Breakout", "Pullback", "Range", "Trend continuation", "Reversal", "News"];

function toLocalInput(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function TradeForm(props: { accountId: string; currency: string; defaults?: TradeDefaults; checklist: string[]; canScreenshots: boolean; maxRiskPerTrade: number; todayStatus?: { stop: boolean } }) {
  const edit = !!props.defaults?.id;
  const [state, action, pending] = useActionState(edit ? updateTradeAction : createTradeAction, {});
  const d = props.defaults ?? {};
  const f = state.fields ?? {};

  const [local, setLocal] = useState(toLocalInput(d.openedAt));
  const [instrument, setInstrument] = useState(d.instrument ?? "XAUUSD");
  const [direction, setDirection] = useState<"LONG" | "SHORT">(d.direction ?? "LONG");
  const [entry, setEntry] = useState(d.entryPrice ?? "");
  const [stop, setStop] = useState(d.stopLoss ?? "");
  const [lots, setLots] = useState(d.lots ?? "");
  const [riskAmount, setRiskAmount] = useState(d.riskAmount ?? "");
  const [riskTouched, setRiskTouched] = useState(!!d.riskAmount);

  const [checked, setChecked] = useState<boolean[]>(() => props.checklist.map(() => false));
  const [checklistOpen, setChecklistOpen] = useState(false);
  const score = disciplineScore(checked.filter(Boolean).length, props.checklist.length);

  const estimate = useMemo(() => {
    const spec = presetFor(instrument);
    const e = Number(entry), s = Number(stop), l = Number(lots);
    if (!spec || !(e > 0) || !(s > 0) || !(l > 0) || e === s) return null;
    const r = computeRisk({ balance: 1e12, entry: e, stopLoss: s, lots: l, spec, fxRate: spec.quoteCurrency === props.currency ? 1 : DEFAULT_USD_RATES[props.currency] ?? 1 });
    return r.ok ? r.riskAmount : null;
  }, [instrument, entry, stop, lots, props.currency]);
  const shownRisk = riskTouched ? riskAmount : estimate !== null ? estimate.toFixed(2) : riskAmount;

  const openedIso = (() => { const x = new Date(local); return isNaN(x.getTime()) ? "" : x.toISOString(); })();

  return (
    <form action={action} className="space-y-5" encType="multipart/form-data">
      {edit && <input type="hidden" name="id" value={d.id} />}
      <input type="hidden" name="accountId" value={props.accountId} />
      <input type="hidden" name="openedAt" value={openedIso} />
      <input type="hidden" name="direction" value={direction} />
      <input type="hidden" name="riskAmount" value={shownRisk} />
      <input type="hidden" name="checklistScore" value={checklistOpen && props.checklist.length ? String(score) : (d.checklistScore ?? "")} />

      {props.todayStatus?.stop && <p role="alert" className="rounded-lg bg-down-soft px-4 py-3 text-sm font-medium text-down">Daily risk limit reached. Your rule says to stop trading for today. You can still record this trade — honest records make the journal useful.</p>}

      {!edit && props.checklist.length > 0 && (
        <Card>
          <details onToggle={(e) => setChecklistOpen((e.currentTarget as HTMLDetailsElement).open)}>
            <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
              <span>Pre-trade checklist <span className="font-normal text-muted">(optional)</span></span>
              {checklistOpen && <Badge tone={score >= 80 ? "up" : score >= 50 ? "warn" : "down"}>Discipline {score}%</Badge>}
            </summary>
            <div className="space-y-2 border-t border-line p-4">
              {props.checklist.map((item, i) => (
                <label key={i} className="flex items-center gap-3 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-blue-500" checked={checked[i]} onChange={(e) => setChecked((c) => c.map((v, j) => (j === i ? e.target.checked : v)))} />{item}
                </label>
              ))}
              <p className="pt-1 text-xs text-muted">Pre-trade discipline score — it tracks your habits. It is not a prediction of whether the trade will work.</p>
            </div>
          </details>
        </Card>
      )}

      <Card className="p-4 md:p-5">
        <h2 className="mb-4 text-sm font-semibold">The trade</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="Date & time" error={f.openedAt} className="col-span-2"><Input type="datetime-local" value={local} onChange={(e) => setLocal(e.target.value)} required /></Field>
          <Field label="Instrument" error={f.instrument}><Input name="instrument" value={instrument} onChange={(e) => setInstrument(e.target.value.toUpperCase())} list="symbols" required /></Field>
          <Field label="Direction">
            <div className="grid h-11 grid-cols-2 overflow-hidden rounded-lg border border-line md:h-10">
              {(["LONG", "SHORT"] as const).map((x) => <button type="button" key={x} onClick={() => setDirection(x)} className={cn("text-sm font-medium", direction === x ? (x === "LONG" ? "bg-up-soft text-up" : "bg-down-soft text-down") : "text-muted")}>{x === "LONG" ? "Long" : "Short"}</button>)}
            </div>
          </Field>
          <Field label="Entry price" error={f.entryPrice}><Input name="entryPrice" inputMode="decimal" value={entry} onChange={(e) => setEntry(e.target.value)} required /></Field>
          <Field label="Stop loss" error={f.stopLoss}><Input name="stopLoss" inputMode="decimal" value={stop} onChange={(e) => setStop(e.target.value)} required /></Field>
          <Field label="Take profit" error={f.takeProfit}><Input name="takeProfit" inputMode="decimal" defaultValue={d.takeProfit} /></Field>
          <Field label="Exit price" error={f.exitPrice}><Input name="exitPrice" inputMode="decimal" defaultValue={d.exitPrice} /></Field>
          <Field label="Position size (lots)" error={f.lots}><Input name="lots" inputMode="decimal" value={lots} onChange={(e) => setLots(e.target.value)} required /></Field>
          <Field label={`Amount risked (${props.currency})`} hint="How much you would lose if your stop loss was hit. Filled in from the calculator or estimated from your lot size — change it if your broker shows something different." error={f.riskAmount}>
            <Input inputMode="decimal" value={shownRisk} onChange={(e) => { setRiskTouched(true); setRiskAmount(e.target.value); }} required />
          </Field>
          <Field label={`Result P&L (${props.currency})`} hint="What the trade actually made or lost, from your broker. Leave empty while the trade is still open." error={f.pnl}><Input name="pnl" inputMode="decimal" defaultValue={d.pnl} placeholder="e.g. 24.50 or -10" /></Field>
          <Field label="Risk %" hint="Calculated for you: amount risked ÷ account balance at the time.">
            <div className="flex h-11 items-center rounded-lg border border-line bg-bg/40 px-3 text-sm text-muted md:h-10">auto</div>
          </Field>
        </div>
        <datalist id="symbols">{["XAUUSD", "BTCUSD", "ETHUSD", "EURUSD", "GBPUSD", "USDJPY", "US30", "NAS100"].map((s) => <option key={s} value={s} />)}</datalist>
      </Card>

      <Card className="p-4 md:p-5">
        <h2 className="mb-4 text-sm font-semibold">Context</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="Setup"><Input name="setup" list="setups" defaultValue={d.setup} placeholder="Your own label" /></Field>
          <datalist id="setups">{SETUPS.map((s) => <option key={s} value={s} />)}</datalist>
          <Field label="Session"><Select name="session" defaultValue={d.session ?? ""}><option value="">—</option>{SESSIONS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="Emotion before"><Select name="emotionBefore" defaultValue={d.emotionBefore ?? ""}><option value="">—</option>{EMOTIONS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="Emotion after"><Select name="emotionAfter" defaultValue={d.emotionAfter ?? ""}><option value="">—</option>{EMOTIONS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="Reason for entry" className="col-span-2"><Textarea name="reasonEntry" defaultValue={d.reasonEntry} placeholder="Why did you take this trade?" /></Field>
          <Field label="Reason for exit" className="col-span-2"><Textarea name="reasonExit" defaultValue={d.reasonExit} /></Field>
          <Field label="Tags" hint="Comma separated, e.g. london, news, fomo" className="col-span-2"><Input name="tags" defaultValue={d.tags} /></Field>
          <Field label="Notes" className="col-span-2"><Textarea name="notes" defaultValue={d.notes} /></Field>
        </div>
      </Card>

      <Card className="p-4 md:p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">Screenshots {!props.canScreenshots && <Badge tone="accent">Pro</Badge>}<Hint text="PNG, JPEG or WebP, up to 5 MB each, up to 6 per trade." /></h2>
        {props.canScreenshots ? <input type="file" name="screenshots" accept="image/png,image/jpeg,image/webp" multiple className="mt-2 block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-fg" /> : <p className="text-sm text-muted">Upgrade to Pro to attach chart screenshots to your trades.</p>}
      </Card>

      {state.error && <p role="alert" className="rounded-lg bg-down-soft px-4 py-3 text-sm text-down">{state.error}</p>}
      {Object.keys(f).length > 0 && <p role="alert" className="text-sm text-down">Please fix the highlighted fields.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" disabled={pending}>{pending ? "Saving…" : edit ? "Save changes" : "Save trade"}</Button>
      </div>
      <Disclaimer compact />
    </form>
  );
}
