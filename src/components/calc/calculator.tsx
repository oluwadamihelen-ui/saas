"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Save } from "lucide-react";
import { Badge, Button, Card, Disclaimer, Field, Hint, Input, Select, type Tone } from "@/components/ui";
import { DEFAULT_USD_RATES, INSTRUMENT_PRESETS, presetFor } from "@/lib/engine/instruments";
import { DEFAULT_BANDS, computePositionSize, computeRisk, type InstrumentSpec, type RiskBands, type RiskLevel } from "@/lib/engine/risk";
import { cn, money, price } from "@/lib/utils";

export interface CalcInitial {
  symbol?: string;
  balance?: number;
  riskPercent?: number;
  entry?: string;
  stop?: string;
  tp?: string;
  lots?: string;
  spec?: InstrumentSpec;
  confirmed?: boolean;
  fx?: number;
}
export interface SavedSpecs {
  [symbol: string]: { spec: InstrumentSpec; confirmed: boolean };
}
export interface SaveCalcPayload {
  instrument: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number | null;
  balance: number;
  riskPercent: number;
  riskAmount: number;
  lots: number;
  lossPerLot: number;
  specConfirmed: boolean;
  inputs: Record<string, unknown>;
}

const LEVEL_TONE: Record<RiskLevel, Tone> = { LOW: "up", MODERATE: "accent", HIGH: "warn", EXTREME: "down" };
export const LEVEL_LABEL: Record<RiskLevel, string> = { LOW: "Low risk", MODERATE: "Moderate", HIGH: "High risk", EXTREME: "Extreme" };

const N = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(/,/g, "")));

export function RiskLevelBadge({ level }: { level: RiskLevel }) {
  return <Badge tone={LEVEL_TONE[level]}>{LEVEL_LABEL[level]}</Badge>;
}

export function Calculator(props: {
  mode: "size" | "risk";
  currency: string;
  initial?: CalcInitial;
  savedSpecs?: SavedSpecs;
  maxRiskPerTrade?: number;
  bands?: RiskBands;
  /** Present in the app (saves history & specs); absent on the public landing demo. */
  onSave?: (p: SaveCalcPayload) => Promise<{ ok: boolean; error?: string }>;
  onSaveSpec?: (symbol: string, spec: InstrumentSpec, confirmed: boolean) => Promise<{ ok: boolean; error?: string }>;
  showJournalLink?: boolean;
}) {
  const { mode, currency, initial = {}, savedSpecs = {}, bands = DEFAULT_BANDS } = props;
  const [symbol, setSymbol] = useState(initial.symbol ?? "XAUUSD");
  const startSpec = initial.spec ?? savedSpecs[symbol]?.spec ?? presetFor(symbol) ?? INSTRUMENT_PRESETS[0];
  const [spec, setSpec] = useState<InstrumentSpec>(startSpec);
  const [confirmed, setConfirmed] = useState(initial.confirmed ?? savedSpecs[symbol]?.confirmed ?? false);
  const [balance, setBalance] = useState(String(initial.balance ?? 1000));
  const [risk, setRisk] = useState(String(initial.riskPercent ?? 1));
  const [entry, setEntry] = useState(initial.entry ?? "");
  const [stop, setStop] = useState(initial.stop ?? "");
  const [tp, setTp] = useState(initial.tp ?? "");
  const [lots, setLots] = useState(initial.lots ?? "");
  const [fx, setFx] = useState(String(initial.fx ?? DEFAULT_USD_RATES[currency] ?? 1));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const needsFx = currency !== spec.quoteCurrency;
  const fxRate = needsFx ? N(fx) : 1;

  function pickSymbol(s: string) {
    setSymbol(s);
    const saved = savedSpecs[s];
    setSpec(saved?.spec ?? presetFor(s) ?? { ...spec, symbol: s });
    setConfirmed(saved?.confirmed ?? false);
    setMsg(null);
  }
  function setSpecField(k: keyof InstrumentSpec, v: string) {
    setSpec((p) => ({ ...p, [k]: k === "symbol" || k === "quoteCurrency" ? v : N(v) }) as InstrumentSpec);
    setConfirmed(false); // changing a number invalidates the broker confirmation
  }

  const entryN = N(entry), stopN = N(stop), tpN = tp.trim() === "" ? null : N(tp);
  const ready = Number.isFinite(entryN) && Number.isFinite(stopN) && (mode === "size" ? risk.trim() !== "" : lots.trim() !== "");
  const specN = spec;

  const result = useMemo(() => {
    if (!ready) return null;
    if (mode === "size") {
      return computePositionSize({ balance: N(balance), riskPercent: N(risk), entry: entryN, stopLoss: stopN, takeProfit: tpN, spec: specN, fxRate, specConfirmed: confirmed, maxRiskPerTrade: props.maxRiskPerTrade, bands });
    }
    return computeRisk({ balance: N(balance), entry: entryN, stopLoss: stopN, takeProfit: tpN, lots: N(lots), spec: specN, fxRate, specConfirmed: confirmed, bands });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, mode, balance, risk, entryN, stopN, tpN, lots, specN, fxRate, confirmed]);

  const ok = result && result.ok ? result : null;
  const sizeRes = ok && mode === "size" ? (ok as Extract<ReturnType<typeof computePositionSize>, { ok: true }>) : null;
  const riskRes = ok && mode === "risk" ? (ok as Extract<ReturnType<typeof computeRisk>, { ok: true }>) : null;

  const finalLots = sizeRes ? sizeRes.size.lots : riskRes ? N(lots) : 0;
  const riskAmount = sizeRes ? sizeRes.actualRisk : riskRes?.riskAmount ?? 0;
  const riskPct = sizeRes ? sizeRes.actualRiskPercent : riskRes?.riskPercent ?? 0;
  const level = ok ? (ok.level) : null;
  const warnings = ok ? ok.warnings : [];
  const rr = ok?.riskReward ?? null;

  function save() {
    if (!ok || !props.onSave || !sizeRes) return;
    start(async () => {
      const r = await props.onSave!({
        instrument: symbol, entryPrice: entryN, stopLoss: stopN, takeProfit: tpN, balance: N(balance), riskPercent: N(risk),
        riskAmount: sizeRes.actualRisk, lots: sizeRes.size.lots, lossPerLot: sizeRes.lossPerLot, specConfirmed: confirmed,
        inputs: { spec, fx: fxRate, balance: N(balance), riskPercent: N(risk), entry, stop, tp },
      });
      setMsg({ ok: r.ok, text: r.ok ? "Saved to your history." : r.error ?? "Could not save." });
    });
  }
  function saveSpec() {
    if (!props.onSaveSpec) return;
    start(async () => {
      const r = await props.onSaveSpec!(symbol, spec, confirmed);
      setMsg({ ok: r.ok, text: r.ok ? `Specs saved for ${symbol} on this account.` : r.error ?? "Could not save." });
    });
  }

  const journalHref = ok && finalLots > 0
    ? `/journal/new?${new URLSearchParams({ instrument: symbol, entry: String(entryN), stop: String(stopN), ...(tpN ? { tp: String(tpN) } : {}), lots: String(finalLots), riskAmount: riskAmount.toFixed(2) })}`
    : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card className="p-4 md:p-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Instrument" className="col-span-2 sm:col-span-1">
            <Select value={symbol} onChange={(e) => pickSymbol(e.target.value)} aria-label="Instrument">
              {INSTRUMENT_PRESETS.map((p) => <option key={p.symbol}>{p.symbol}</option>)}
              {!presetFor(symbol) && <option>{symbol}</option>}
            </Select>
          </Field>
          <Field label={`Account balance (${currency})`} className="col-span-2 sm:col-span-1">
            <Input inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} />
          </Field>
          <Field label="Entry price"><Input inputMode="decimal" placeholder="2650" value={entry} onChange={(e) => setEntry(e.target.value)} autoFocus /></Field>
          <Field label="Stop-loss price" hint="The price where your trade is wrong and you exit. It decides how far price can move against you.">
            <Input inputMode="decimal" placeholder="2640" value={stop} onChange={(e) => setStop(e.target.value)} />
          </Field>
          {mode === "size" ? (
            <Field label="How much to risk (%)" hint="The share of your account you accept losing if the stop loss is hit. Many traders keep this at 1% or less.">
              <Input inputMode="decimal" value={risk} onChange={(e) => setRisk(e.target.value)} />
            </Field>
          ) : (
            <Field label="Position size (lots)" hint="The lot size you plan to trade, as shown in MT5 or your broker.">
              <Input inputMode="decimal" placeholder="0.10" value={lots} onChange={(e) => setLots(e.target.value)} />
            </Field>
          )}
          <Field label="Take profit (optional)"><Input inputMode="decimal" placeholder="2680" value={tp} onChange={(e) => setTp(e.target.value)} /></Field>
        </div>

        <details className="mt-4 rounded-lg border border-line bg-bg/40">
          <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium">
            <span>Contract specification</span>
            <Badge tone={confirmed ? "up" : "warn"}>{confirmed ? "Broker spec confirmed" : "Estimated"}</Badge>
          </summary>
          <div className="space-y-3 border-t border-line p-3">
            <p className="text-xs text-warn">These are common defaults. Always verify contract specifications with your broker.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Contract size" hint="Units of the asset in one lot (e.g. 100 oz for gold on many brokers)."><Input inputMode="decimal" value={spec.contractSize} onChange={(e) => setSpecField("contractSize", e.target.value)} /></Field>
              <Field label="Tick size" hint="The smallest price step the instrument moves."><Input inputMode="decimal" value={spec.tickSize} onChange={(e) => setSpecField("tickSize", e.target.value)} /></Field>
              <Field label={`Tick value (${spec.quoteCurrency})`} hint="How much 1 lot gains or loses when price moves by one tick. Check it in your MT5 symbol specification."><Input inputMode="decimal" value={spec.tickValue} onChange={(e) => setSpecField("tickValue", e.target.value)} /></Field>
              <Field label="Min lot"><Input inputMode="decimal" value={spec.minLot} onChange={(e) => setSpecField("minLot", e.target.value)} /></Field>
              <Field label="Max lot"><Input inputMode="decimal" value={spec.maxLot} onChange={(e) => setSpecField("maxLot", e.target.value)} /></Field>
              <Field label="Lot step"><Input inputMode="decimal" value={spec.lotStep} onChange={(e) => setSpecField("lotStep", e.target.value)} /></Field>
            </div>
            {needsFx && (
              <Field label={`Exchange rate (1 ${spec.quoteCurrency} = ? ${currency})`} hint={`Tick value is in ${spec.quoteCurrency}; this converts it to your account currency. Enter today's rate — it is not fetched live.`}>
                <Input inputMode="decimal" value={fx} onChange={(e) => setFx(e.target.value)} />
              </Field>
            )}
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-blue-500" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              <span>I confirmed these values with my broker</span>
            </label>
            {props.onSaveSpec && <Button type="button" variant="secondary" size="sm" onClick={saveSpec} disabled={pending}>Save specs for {symbol} on this account</Button>}
          </div>
        </details>
      </Card>

      <div className="space-y-4">
        <Card className={cn("p-4 md:p-5", level === "EXTREME" && "border-down/60")} aria-live="polite">
          {!result && <p className="py-10 text-center text-sm text-muted">{mode === "size" ? "Enter your entry and stop loss to see how big your position can be." : "Enter entry, stop loss and lot size to see how much you are risking."}</p>}
          {result && !result.ok && (
            <ul className="space-y-1 py-4 text-sm text-down">{result.errors.map((e, i) => <li key={i} className="flex gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{e.message}</li>)}</ul>
          )}
          {ok && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted">{mode === "size" ? "Position size" : "You are risking"}</div>
                  <div className="num mt-1 text-4xl font-semibold">
                    {mode === "size" ? (finalLots > 0 ? <>{finalLots}<span className="ml-2 text-lg font-normal text-muted">lots</span></> : <span className="text-down">Too small</span>) : money(riskAmount, currency)}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  {level && <RiskLevelBadge level={level} />}
                  <Badge tone={ok.specStatus === "confirmed" ? "up" : "warn"}>{ok.specStatus === "confirmed" ? <><CheckCircle2 size={12} /> Broker spec confirmed</> : "Estimated"}</Badge>
                </div>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Row k={mode === "size" ? "Amount at risk" : "Risk amount"} v={money(riskAmount, currency, { decimals: 2 })} />
                <Row k="% of account at risk" v={`${riskPct.toFixed(2)}%`} />
                <Row k="Stop-loss distance" v={price(ok.stopDistance)} hint="How far your stop is from your entry, in price." />
                <Row k="Risk / reward" v={rr ? `1 : ${rr.toFixed(2)}` : "—"} hint="Reward distance divided by risk distance. 1 : 2 means the target is twice as far as the stop." />
                <Row k="Potential loss" v={`-${money(riskAmount, currency, { decimals: 2 })}`} tone="down" />
                <Row k="Potential profit" v={ok.potentialProfit !== null ? `+${money(ok.potentialProfit, currency, { decimals: 2 })}` : "—"} tone={ok.potentialProfit !== null ? "up" : undefined} />
                {sizeRes && <Row k="Direction (from your prices)" v={ok.direction === "LONG" ? "Long" : "Short"} />}
                {sizeRes && <Row k="Loss per 1 lot" v={money(sizeRes.lossPerLot, currency, { decimals: 2 })} />}
              </dl>
              {warnings.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {warnings.map((w, i) => <li key={i} className="flex gap-2 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{w}</li>)}
                </ul>
              )}
              {level === "EXTREME" && <p className="mt-3 rounded-lg bg-down-soft px-3 py-2 text-xs font-medium text-down">This is an extreme level of risk for one trade. It is your decision, but check your numbers.</p>}
              <div className="mt-5 flex flex-wrap gap-2">
                {props.onSave && sizeRes && finalLots > 0 && <Button variant="secondary" onClick={save} disabled={pending}><Save size={15} /> Save calculation</Button>}
                {props.showJournalLink && journalHref && <Link href={journalHref} className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-white hover:bg-blue-500">Record this trade →</Link>}
              </div>
            </>
          )}
          {msg && <p role="status" className={cn("mt-3 text-sm", msg.ok ? "text-up" : "text-down")}>{msg.text}</p>}
        </Card>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
          <span className="font-semibold uppercase tracking-wider">Risk levels</span>
          <Badge tone="up">Low ≤{bands.lowMax}%</Badge><Badge tone="accent">Moderate ≤{bands.moderateMax}%</Badge><Badge tone="warn">High ≤{bands.highMax}%</Badge><Badge tone="down">Extreme &gt;{bands.highMax}%</Badge>
          <Hint text="Labels describe how large the risk is relative to your account. They are not trade recommendations. You can change the thresholds in Risk Rules." />
        </div>
        <Disclaimer />
      </div>
    </div>
  );
}

function Row({ k, v, tone, hint }: { k: string; v: string; tone?: "up" | "down"; hint?: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs text-muted">{k}{hint && <Hint text={hint} />}</dt>
      <dd className={cn("num mt-0.5 font-medium", tone === "up" && "text-up", tone === "down" && "text-down")}>{v}</dd>
    </div>
  );
}
