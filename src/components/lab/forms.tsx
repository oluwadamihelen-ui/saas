"use client";
import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, Field, Hint, Input, Select, Textarea } from "@/components/ui";
import { parsePine, type PineInput } from "@/lib/lab/pine";
import { LAB_TIMEFRAMES, MARKETS } from "@/lib/lab/schemas";
import { INSTRUMENT_PRESETS, PIP_SIZE, presetFor } from "@/lib/engine/instruments";
import { LAB_SESSIONS, type CompareOp, type Cond, type IndicatorName, type Num, type Operand, type PriceField, type StrategyDef } from "@/lib/lab/types";
import { collectParams } from "@/lib/lab/backtest";
import { OVERFIT_WARNING } from "@/lib/lab/report";
import type { ActionState } from "@/lib/validation";
import {
  addVersionAction, createDatasetAction, createIndicatorAction, createSyntheticDatasetAction, importTvAction, runBacktestAction, runOptimizationAction,
  runWalkForwardAction, saveStrategyAction, updateIndicatorAction,
} from "@/actions/lab";
import { cn } from "@/lib/utils";

type Act = (s: ActionState, fd: FormData) => Promise<ActionState>;

function Msg({ s }: { s: ActionState }) {
  return (<>
    {s.error && <p role="alert" className="rounded-lg bg-down-soft px-3 py-2 text-sm text-down">{s.error}</p>}
    {s.message && <p role="status" className="rounded-lg bg-up-soft px-3 py-2 text-sm text-up">{s.message}</p>}
  </>);
}

function Checks({ name, options, value, onChange }: { name: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <input type="hidden" name={name} value={value.join(",")} />
      {options.map((o) => {
        const on = value.includes(o);
        return <button key={o} type="button" onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])} className={cn("rounded-lg border px-3 py-1.5 text-sm", on ? "border-accent bg-accent-soft" : "border-line text-muted hover:text-fg")} aria-pressed={on}>{o}</button>;
      })}
    </div>
  );
}

const VISIBILITY = [
  { v: "PRIVATE", t: "Private", d: "Only you. Nobody else can see it, ever, unless you change this." },
  { v: "UNLISTED", t: "Unlisted", d: "Not shown in marketplace search. Anyone with the link can view the listing once it's approved." },
  { v: "PUBLIC", t: "Public", d: "Appears in marketplace search once the listing is approved." },
] as const;

export function VisibilityPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <input type="hidden" name="visibility" value={value} />
      {VISIBILITY.map((o) => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)} aria-pressed={value === o.v} className={cn("rounded-lg border p-3 text-left text-sm", value === o.v ? "border-accent bg-accent-soft" : "border-line hover:border-muted/60")}>
          <span className="font-medium">{o.t}</span><span className="mt-1 block text-xs text-muted">{o.d}</span>
        </button>
      ))}
    </div>
  );
}

// ================================================================== indicators

export function IndicatorForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createIndicatorAction as Act, {});
  const [source, setSource] = useState("");
  const [name, setName] = useState("");
  const [markets, setMarkets] = useState<string[]>(["XAUUSD"]);
  const [tfs, setTfs] = useState<string[]>(["M15", "H1", "H4"]);
  const [visibility, setVisibility] = useState("PRIVATE");
  const [inputs, setInputs] = useState<PineInput[] | null>(null);
  const meta = useMemo(() => (source.trim() ? parsePine(source) : null), [source]);
  const shown = inputs ?? meta?.inputs ?? [];

  function onSource(v: string) {
    setSource(v);
    setInputs(null);
    const m = v.trim() ? parsePine(v) : null;
    if (m?.title && !name) setName(m.title);
  }
  async function onFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 200 * 1024) { alert("Script is larger than 200 KB."); return; }
    onSource(await f.text());
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="inputs" value={JSON.stringify(shown)} />
      <Card className="p-4 md:p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Indicator name" className="md:col-span-2"><Input name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gold Sniper V1" required /></Field>
          <Field label="Description" className="md:col-span-2"><Textarea name="description" placeholder="What does it draw or calculate? (Describe the tool — not promised results.)" /></Field>
          <Field label="Version"><Input name="version" defaultValue="1.0" /></Field>
          <div />
          <div className="md:col-span-2"><span className="mb-1.5 block text-xs font-medium text-muted">Markets it supports</span><Checks name="markets" options={MARKETS} value={markets} onChange={setMarkets} /></div>
          <div className="md:col-span-2"><span className="mb-1.5 block text-xs font-medium text-muted">Timeframes</span><Checks name="timeframes" options={LAB_TIMEFRAMES} value={tfs} onChange={setTfs} /></div>
          <div className="md:col-span-2"><span className="mb-1.5 block text-xs font-medium text-muted">Who can see it</span><VisibilityPicker value={visibility} onChange={setVisibility} /></div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Pine Script" hint="Your script is stored privately. RiskPilot reads it as text to find its version and inputs — it never runs it, and no one else can see it unless you choose to include source code with a product you sell." />
        <div className="space-y-3 p-4">
          <input type="file" accept=".pine,.txt,text/plain" onChange={(e) => onFile(e.target.files?.[0])} className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-fg" />
          <Textarea name="source" value={source} onChange={(e) => onSource(e.target.value)} rows={14} spellCheck={false} className="font-mono text-xs" placeholder={'//@version=5\nindicator("My Indicator", overlay=true)\nlen = input.int(20, "Length")\nplot(ta.ema(close, len))'} required />
          {meta && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge tone="accent">{meta.kind === "unknown" ? "kind not detected" : meta.kind}</Badge>
              <Badge>{meta.version ? `Pine v${meta.version}` : "version not found"}</Badge>
              {meta.warnings.map((w) => <Badge key={w} tone="warn">{w}</Badge>)}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title={`Inputs (${shown.length})`} hint="Detected from your input.*() calls. Edit titles or defaults, or remove rows you don't want to document." />
        {shown.length === 0 ? <p className="p-4 text-sm text-muted">No inputs detected yet. Paste a script above.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted"><tr><th className="px-4 py-2 font-semibold">Variable</th><th className="px-2 py-2 font-semibold">Type</th><th className="px-2 py-2 font-semibold">Title</th><th className="px-2 py-2 font-semibold">Default</th><th className="px-2 py-2 font-semibold">Range</th><th /></tr></thead>
              <tbody className="divide-y divide-line">
                {shown.map((i, k) => (
                  <tr key={i.name + k}>
                    <td className="num px-4 py-2">{i.name}</td><td className="px-2 py-2"><Badge>{i.type}</Badge></td>
                    <td className="px-2 py-2"><Input value={i.title} onChange={(e) => setInputs(shown.map((x, j) => (j === k ? { ...x, title: e.target.value } : x)))} className="h-8" /></td>
                    <td className="px-2 py-2"><Input value={String(i.defval ?? "")} onChange={(e) => setInputs(shown.map((x, j) => (j === k ? { ...x, defval: e.target.value } : x)))} className="h-8 w-28" /></td>
                    <td className="num px-2 py-2 text-muted">{i.min !== undefined || i.max !== undefined ? `${i.min ?? "…"} – ${i.max ?? "…"}` : i.options ? i.options.join(" / ") : "—"}</td>
                    <td className="px-2 py-2"><button type="button" aria-label={`Remove ${i.name}`} onClick={() => setInputs(shown.filter((_, j) => j !== k))} className="text-muted hover:text-down"><Trash2 size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Msg s={state} />
      <Button size="lg" disabled={pending}>{pending ? "Saving…" : "Save indicator"}</Button>
    </form>
  );
}

export function IndicatorMetaForm({ id, name, description, markets, timeframes, visibility }: { id: string; name: string; description: string; markets: string[]; timeframes: string[]; visibility: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateIndicatorAction as Act, {});
  const [m, setM] = useState(markets), [t, setT] = useState(timeframes), [v, setV] = useState(visibility);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name"><Input name="name" defaultValue={name} required /></Field>
        <Field label="Description" className="md:col-span-2"><Textarea name="description" defaultValue={description} /></Field>
        <div className="md:col-span-2"><span className="mb-1.5 block text-xs font-medium text-muted">Markets</span><Checks name="markets" options={MARKETS} value={m} onChange={setM} /></div>
        <div className="md:col-span-2"><span className="mb-1.5 block text-xs font-medium text-muted">Timeframes</span><Checks name="timeframes" options={LAB_TIMEFRAMES} value={t} onChange={setT} /></div>
        <div className="md:col-span-2"><span className="mb-1.5 block text-xs font-medium text-muted">Visibility</span><VisibilityPicker value={v} onChange={setV} /></div>
      </div>
      <Msg s={state} />
      <Button disabled={pending}>{pending ? "Saving…" : "Save details"}</Button>
    </form>
  );
}

export function VersionForm({ id, latest }: { id: string; latest: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addVersionAction as Act, {});
  const [source, setSource] = useState("");
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New version" hint={`Must be higher than ${latest}, e.g. 1.1 or 2.0`}><Input name="version" placeholder="1.1" required /></Field>
        <Field label="Compatibility"><Input name="compatibility" placeholder="Pine Script v5, any timeframe" /></Field>
        <Field label="Change log" className="sm:col-span-2" hint="What changed? Buyers see this in the update history."><Textarea name="changelog" placeholder={"- Added session filter\n- Fixed calculation issue"} required /></Field>
        <Field label="Updated Pine Script" className="sm:col-span-2"><Textarea name="source" value={source} onChange={(e) => setSource(e.target.value)} rows={8} spellCheck={false} className="font-mono text-xs" required /></Field>
      </div>
      <Msg s={state} />
      <Button disabled={pending}>{pending ? "Releasing…" : "Release version"}</Button>
    </form>
  );
}

// ================================================================== strategy builder

const PRICE_OPS: { v: CompareOp; l: string }[] = [
  { v: "crosses_above", l: "crosses above" }, { v: "crosses_below", l: "crosses below" }, { v: "gt", l: "is above" }, { v: "lt", l: "is below" }, { v: "gte", l: "is at or above" }, { v: "lte", l: "is at or below" },
];
type Kind = "price:close" | "price:open" | "price:high" | "price:low" | `ind:${IndicatorName}` | "num";
const KINDS: { v: Kind; l: string }[] = [
  { v: "price:close", l: "Close" }, { v: "price:open", l: "Open" }, { v: "price:high", l: "High" }, { v: "price:low", l: "Low" },
  { v: "ind:ema", l: "EMA" }, { v: "ind:sma", l: "SMA" }, { v: "ind:rsi", l: "RSI" }, { v: "ind:atr", l: "ATR" }, { v: "ind:highest", l: "Highest high (prev N bars)" }, { v: "ind:lowest", l: "Lowest low (prev N bars)" }, { v: "num", l: "Number" },
];

const numText = (n: Num): string => (typeof n === "number" ? String(n) : `$${n.param}`);
function parseNum(t: string): Num {
  const s = t.trim();
  const m = s.match(/^\$([A-Za-z_]\w{0,30})$/);
  if (m) return { param: m[1] };
  const v = Number(s);
  return Number.isFinite(v) ? v : 0;
}
const kindOf = (o: Operand): Kind => (o.k === "price" ? (`price:${o.f}` as Kind) : o.k === "ind" ? (`ind:${o.name}` as Kind) : "num");

function OperandEditor({ op, onChange }: { op: Operand; onChange: (o: Operand) => void }) {
  const kind = kindOf(op);
  function setKind(k: Kind) {
    if (k.startsWith("price:")) onChange({ k: "price", f: k.slice(6) as PriceField });
    else if (k.startsWith("ind:")) onChange({ k: "ind", name: k.slice(4) as IndicatorName, period: op.k === "ind" ? op.period : 14 });
    else onChange({ k: "num", v: op.k === "num" ? op.v : 0 });
  }
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Select value={kind} onChange={(e) => setKind(e.target.value as Kind)} className="h-9 min-w-0 flex-1 text-xs">{KINDS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}</Select>
      {op.k === "ind" && <Input aria-label="Period" value={numText(op.period)} onChange={(e) => onChange({ ...op, period: parseNum(e.target.value) })} className="h-9 w-16 text-xs" title="Period — type $name to make it a testable parameter" />}
      {op.k === "num" && <Input aria-label="Value" value={numText(op.v)} onChange={(e) => onChange({ k: "num", v: parseNum(e.target.value) })} className="h-9 w-20 text-xs" />}
    </div>
  );
}

function CondEditor({ title, hint, conds, onChange }: { title: string; hint: string; conds: Cond[]; onChange: (c: Cond[]) => void }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between"><h4 className="flex items-center gap-1.5 text-sm font-semibold">{title}<Hint text={hint} /></h4>{conds.length < 6 && <button type="button" onClick={() => onChange([...conds, { l: { k: "price", f: "close" }, op: "gt", r: { k: "num", v: 0 } }])} className="flex items-center gap-1 text-xs text-accent hover:underline"><Plus size={13} /> Add condition</button>}</div>
      {conds.length === 0 ? <p className="rounded-lg border border-dashed border-line px-3 py-2 text-xs text-muted">None — this rule is turned off.</p> : (
        <div className="space-y-2">
          {conds.map((c, i) => (
            <div key={i} className="grid items-center gap-1.5 rounded-lg border border-line bg-bg/40 p-2 md:grid-cols-[1fr_auto_1fr_auto]">
              <OperandEditor op={c.l} onChange={(l) => onChange(conds.map((x, j) => (j === i ? { ...x, l } : x)))} />
              <Select value={c.op} onChange={(e) => onChange(conds.map((x, j) => (j === i ? { ...x, op: e.target.value as CompareOp } : x)))} className="h-9 text-xs">{PRICE_OPS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</Select>
              <OperandEditor op={c.r} onChange={(r) => onChange(conds.map((x, j) => (j === i ? { ...x, r } : x)))} />
              <button type="button" aria-label="Remove condition" onClick={() => onChange(conds.filter((_, j) => j !== i))} className="justify-self-end text-muted hover:text-down"><Trash2 size={15} /></button>
            </div>
          ))}
          {conds.length > 1 && <p className="text-[11px] text-muted">All conditions must be true on the same bar (AND).</p>}
        </div>
      )}
    </div>
  );
}

export const EMPTY_DEF: StrategyDef = {
  direction: "both", longEntry: [], shortEntry: [], longExit: [], shortExit: [], exitOnOpposite: false, maxBarsInTrade: null,
  stop: { type: "pips", value: 20 }, target: { type: "rr", value: 2 }, sessions: null, defaults: {},
};

const ex = (name: IndicatorName, p: Num): Operand => ({ k: "ind", name, period: p });
const EXAMPLES: { name: string; def: Partial<StrategyDef> }[] = [
  { name: "EMA crossover", def: { longEntry: [{ l: ex("ema", { param: "fast" }), op: "crosses_above", r: ex("ema", { param: "slow" }) }], shortEntry: [{ l: ex("ema", { param: "fast" }), op: "crosses_below", r: ex("ema", { param: "slow" }) }], exitOnOpposite: true, stop: { type: "atr", value: 1.5 }, defaults: { fast: 20, slow: 50 } } },
  { name: "RSI levels", def: { longEntry: [{ l: ex("rsi", 14), op: "crosses_above", r: { k: "num", v: 30 } }], shortEntry: [{ l: ex("rsi", 14), op: "crosses_below", r: { k: "num", v: 70 } }], stop: { type: "atr", value: 2 } } },
  { name: "Range breakout", def: { longEntry: [{ l: { k: "price", f: "close" }, op: "gt", r: ex("highest", 20) }], shortEntry: [{ l: { k: "price", f: "close" }, op: "lt", r: ex("lowest", 20) }], stop: { type: "atr", value: 1.5 } } },
];

export function StrategyBuilder({ initial, id, indicatorId, indicatorName, defaultName, defaultSymbol }: { initial?: StrategyDef; id?: string; indicatorId?: string; indicatorName?: string; defaultName?: string; defaultSymbol?: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveStrategyAction as Act, {});
  const [def, setDef] = useState<StrategyDef>(initial ?? EMPTY_DEF);
  const [name, setName] = useState(defaultName ?? "");
  const [symbol, setSymbol] = useState(defaultSymbol ?? "XAUUSD");
  const params = useMemo(() => collectParams(def), [def]);
  const set = (p: Partial<StrategyDef>) => setDef({ ...def, ...p });
  const defaults = Object.fromEntries(params.map((p) => [p, def.defaults?.[p] ?? 0]));
  const out: StrategyDef = { ...def, defaults };

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={id ?? ""} />
      <input type="hidden" name="indicatorId" value={indicatorId ?? ""} />
      <input type="hidden" name="definition" value={JSON.stringify(out)} />
      <Card className="p-4 md:p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Strategy name" className="md:col-span-2"><Input name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={indicatorName ? `${indicatorName} + 1% risk` : "e.g. EMA Momentum Pro + 1% Risk"} required /></Field>
          <Field label="Instrument"><Select name="symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)}>{INSTRUMENT_PRESETS.map((p) => <option key={p.symbol}>{p.symbol}</option>)}</Select></Field>
        </div>
        {indicatorName && <p className="mt-3 text-xs text-muted">Based on indicator <b>{indicatorName}</b>. RiskPilot doesn&apos;t run your Pine Script — you define here, in plain rules, exactly what counts as an entry, exit, stop and target. An indicator alone is not a strategy.</p>}
      </Card>

      <Card>
        <CardHeader title="Examples" hint="Starting points only — edit anything. They are not recommendations and say nothing about future results." />
        <div className="flex flex-wrap gap-2 p-4">{EXAMPLES.map((e) => <Button key={e.name} type="button" variant="secondary" size="sm" onClick={() => setDef({ ...EMPTY_DEF, ...e.def })}>{e.name}</Button>)}</div>
      </Card>

      <Card className="space-y-6 p-4 md:p-5">
        <Field label="Trade direction"><Select value={def.direction} onChange={(e) => set({ direction: e.target.value as StrategyDef["direction"] })}><option value="both">Long and short</option><option value="long">Long only</option><option value="short">Short only</option></Select></Field>
        <CondEditor title="Long entry — when…" hint="All conditions are checked at the close of a bar; the order is placed at the next bar's open." conds={def.longEntry} onChange={(longEntry) => set({ longEntry })} />
        <CondEditor title="Short entry — when…" hint="Leave empty to disable shorts." conds={def.shortEntry} onChange={(shortEntry) => set({ shortEntry })} />
        <CondEditor title="Long exit signal (optional)" hint="Closes a long at the next open. Stop loss and take profit still apply." conds={def.longExit} onChange={(longExit) => set({ longExit })} />
        <CondEditor title="Short exit signal (optional)" hint="Closes a short at the next open." conds={def.shortExit} onChange={(shortExit) => set({ shortExit })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-blue-500" checked={def.exitOnOpposite} onChange={(e) => set({ exitOnOpposite: e.target.checked })} />Close and reverse when the opposite entry signal appears</label>
          <Field label="Close after N bars (optional)"><Input inputMode="numeric" value={def.maxBarsInTrade ?? ""} onChange={(e) => set({ maxBarsInTrade: e.target.value ? Math.max(1, Math.round(Number(e.target.value)) || 1) : null })} placeholder="no time limit" /></Field>
        </div>
      </Card>

      <Card className="p-4 md:p-5">
        <h3 className="mb-3 text-sm font-semibold">Stop loss, take profit and size</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Stop loss" hint="Distance from the fill price. ATR uses ATR(14) × the multiple. Pips depend on the pip size you set when you run the test."><Select value={def.stop.type} onChange={(e) => set({ stop: { ...def.stop, type: e.target.value as StrategyDef["stop"]["type"] } })}><option value="pips">Pips</option><option value="distance">Price distance</option><option value="atr">ATR multiple</option><option value="percent">% of price</option></Select></Field>
            <Field label="Value" hint="Type $name to test several values later."><Input value={numText(def.stop.value)} onChange={(e) => set({ stop: { ...def.stop, value: parseNum(e.target.value) } })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Take profit"><Select value={def.target.type} onChange={(e) => set({ target: { ...def.target, type: e.target.value as StrategyDef["target"]["type"] } })}><option value="none">None</option><option value="rr">Risk:reward multiple</option><option value="pips">Pips</option><option value="distance">Price distance</option><option value="atr">ATR multiple</option><option value="percent">% of price</option></Select></Field>
            <Field label="Value"><Input value={numText(def.target.value)} onChange={(e) => set({ target: { ...def.target, value: parseNum(e.target.value) } })} disabled={def.target.type === "none"} /></Field>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">Position size is risk-first, like the calculator: lots are worked out from your risk % and the stop distance, rounded down to the lot step. You choose the risk % when you run a test.</p>
        <div className="mt-4"><span className="mb-1.5 block text-xs font-medium text-muted">Only take entries during (optional)</span>
          <div className="flex flex-wrap gap-2">{LAB_SESSIONS.map((s) => { const on = def.sessions?.includes(s) ?? false; return <button type="button" key={s} aria-pressed={on} onClick={() => { const cur = def.sessions ?? []; const next = on ? cur.filter((x) => x !== s) : [...cur, s]; set({ sessions: next.length ? next : null }); }} className={cn("rounded-lg border px-3 py-1.5 text-sm", on ? "border-accent bg-accent-soft" : "border-line text-muted")}>{s}</button>; })}</div>
        </div>
      </Card>

      {params.length > 0 && (
        <Card className="p-4 md:p-5">
          <h3 className="mb-1 text-sm font-semibold">Parameters</h3>
          <p className="mb-3 text-xs text-muted">Values you marked with $name. These are the defaults; you can change them per test or test many values in a parameter test.</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{params.map((p) => <Field key={p} label={p}><Input inputMode="decimal" value={defaults[p]} onChange={(e) => setDef({ ...def, defaults: { ...defaults, [p]: Number(e.target.value) || 0 } })} /></Field>)}</div>
        </Card>
      )}
      <Msg s={state} />
      <Button size="lg" disabled={pending}>{pending ? "Saving…" : id ? "Save strategy" : "Create strategy"}</Button>
    </form>
  );
}

// ================================================================== run forms

interface DatasetLite { id: string; name: string; symbol: string; timeframe: string; fromDate: string; toDate: string; synthetic: boolean }

function CostFields({ symbol, currency = "USD" }: { symbol: string; currency?: string }) {
  const preset = presetFor(symbol);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Field label={`Initial balance (${currency})`}><Input name="initialBalance" inputMode="decimal" defaultValue={10000} /></Field>
        <Field label="Risk per trade (%)" hint="Share of the CURRENT simulated balance risked on each trade."><Input name="riskPercent" inputMode="decimal" defaultValue={1} /></Field>
        <Field label="Pip size" hint="Price units per pip. Used only if your stop/target is in pips."><Input name="pipSize" inputMode="decimal" defaultValue={PIP_SIZE[symbol] ?? 0.0001} key={symbol} /></Field>
        <Field label="Spread (price units)" hint="Full spread. Entries pay half and exits pay half."><Input name="spread" inputMode="decimal" defaultValue={0} /></Field>
        <Field label="Slippage (price units)" hint="Applied against you on every fill."><Input name="slippage" inputMode="decimal" defaultValue={0} /></Field>
        <Field label={`Commission (${currency} per lot, per side)`}><Input name="commissionPerLot" inputMode="decimal" defaultValue={0} /></Field>
      </div>
      <details className="rounded-lg border border-line bg-bg/40">
        <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium">Contract specification <span className="font-normal text-muted">(verify with your broker)</span></summary>
        <div key={symbol} className="grid grid-cols-2 gap-3 border-t border-line p-3 md:grid-cols-3">
          {([["contractSize", "Contract size"], ["tickSize", "Tick size"], ["tickValue", "Tick value"], ["minLot", "Min lot"], ["maxLot", "Max lot"], ["lotStep", "Lot step"]] as const).map(([k, l]) => (
            <Field key={k} label={l}><Input name={k} inputMode="decimal" defaultValue={preset ? preset[k] : ""} /></Field>
          ))}
        </div>
      </details>
    </>
  );
}

function PeriodFields({ ds }: { ds: DatasetLite | undefined }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="From" ><Input type="date" name="fromDate" defaultValue={ds?.fromDate} key={ds?.id + "f"} /></Field>
      <Field label="To"><Input type="date" name="toDate" defaultValue={ds?.toDate} key={ds?.id + "t"} /></Field>
    </div>
  );
}

function DatasetSelect({ datasets, value, onChange }: { datasets: DatasetLite[]; value: string; onChange: (v: string) => void }) {
  if (!datasets.length) return <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">You need candle data first. <a href="/lab/data" className="underline">Add a dataset</a>.</p>;
  return (
    <Field label="Candle data"><Select name="datasetId" value={value} onChange={(e) => onChange(e.target.value)}>{datasets.map((d) => <option key={d.id} value={d.id}>{d.synthetic ? "⚠ SYNTHETIC · " : ""}{d.name} · {d.symbol} {d.timeframe} · {d.fromDate} → {d.toDate}</option>)}</Select></Field>
  );
}

export function RunForm({ strategyId, datasets, params, mode }: { strategyId: string; datasets: DatasetLite[]; params: { name: string; value: number }[]; mode: "single" | "optimize" | "walkforward" }) {
  const act = mode === "single" ? runBacktestAction : mode === "optimize" ? runOptimizationAction : runWalkForwardAction;
  const [state, action, pending] = useActionState<ActionState, FormData>(act as Act, {});
  const [dsId, setDsId] = useState(datasets[0]?.id ?? "");
  const ds = datasets.find((d) => d.id === dsId);
  const midpoint = ds ? new Date((Date.parse(ds.fromDate) * 0.3 + Date.parse(ds.toDate) * 0.7)).toISOString().slice(0, 10) : "";
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="strategyId" value={strategyId} />
      <Card className="space-y-4 p-4 md:p-5">
        <DatasetSelect datasets={datasets} value={dsId} onChange={setDsId} />
        {ds?.synthetic && <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs font-medium text-warn">Synthetic demo data — not real prices. Results can&apos;t be used as marketplace evidence.</p>}
        <PeriodFields ds={ds} />
        <CostFields symbol={ds?.symbol ?? "XAUUSD"} />
        {mode === "single" && <Field label="Label (optional)"><Input name="label" placeholder="e.g. 2025 H1, with 0.3 spread" /></Field>}
      </Card>

      {mode === "single" && params.length > 0 && (
        <Card className="p-4 md:p-5"><h3 className="mb-3 text-sm font-semibold">Parameters</h3><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{params.map((p) => <Field key={p.name} label={p.name}><Input name={`param_${p.name}`} inputMode="decimal" defaultValue={p.value} /></Field>)}</div></Card>
      )}

      {mode === "optimize" && (
        <Card className="p-4 md:p-5">
          <h3 className="mb-1 text-sm font-semibold">Values to test</h3>
          <p className="mb-3 text-xs text-muted">Comma-separated (<code>20, 50, 100</code>) or a range (<code>10-30:10</code> = 10, 20, 30). Up to 60 combinations in total. Leave a parameter blank to keep its default.</p>
          {params.length === 0 ? <p className="text-sm text-muted">This strategy has no $parameters. Edit the rules and type <code>$name</code> in a period or stop value.</p> : <div className="grid gap-3 sm:grid-cols-2">{params.map((p) => <Field key={p.name} label={`${p.name} (default ${p.value})`}><Input name={`grid_${p.name}`} placeholder="e.g. 20, 50, 100" /></Field>)}</div>}
          <p role="note" className="mt-4 flex gap-2 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">{OVERFIT_WARNING}</p>
        </Card>
      )}

      {mode === "walkforward" && (
        <Card className="p-4 md:p-5">
          <h3 className="mb-1 text-sm font-semibold">Split</h3>
          <p className="mb-3 text-xs text-muted">The same fixed parameters are tested on two separate periods: before the split (optimization / in-sample) and from the split onward (out-of-sample).</p>
          <Field label="Out-of-sample starts on"><Input type="date" name="splitDate" defaultValue={midpoint} key={dsId} required /></Field>
          {params.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">{params.map((p) => <Field key={p.name} label={p.name}><Input name={`param_${p.name}`} inputMode="decimal" defaultValue={p.value} /></Field>)}</div>}
          <p className="mt-3 text-xs text-muted">You choose the parameter values — RiskPilot never picks a &ldquo;best&rdquo; configuration for you.</p>
        </Card>
      )}
      <Msg s={state} />
      <Button size="lg" disabled={pending || !datasets.length}>{pending ? "Running…" : mode === "single" ? "Run backtest" : mode === "optimize" ? "Run parameter test" : "Run walk-forward test"}</Button>
    </form>
  );
}

// ================================================================== data & imports

export function DatasetForms() {
  const [s1, a1, p1] = useActionState<ActionState, FormData>(createDatasetAction as Act, {});
  const [s2, a2, p2] = useActionState<ActionState, FormData>(createSyntheticDatasetAction as Act, {});
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="Upload candles (CSV)" hint="Needs time, open, high, low, close columns (volume optional). Works with TradingView exports and MT5 history exports. Up to 60,000 candles." />
        <form action={a1} className="space-y-3 p-4">
          <Field label="CSV file"><Input type="file" name="file" accept=".csv,text/csv,text/plain" className="h-auto py-2" required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name"><Input name="name" placeholder="XAUUSD H1 2023–2026" /></Field>
            <Field label="Instrument"><Select name="symbol">{INSTRUMENT_PRESETS.map((p) => <option key={p.symbol}>{p.symbol}</option>)}</Select></Field>
            <Field label="Timeframe"><Select name="timeframe" defaultValue="AUTO"><option value="AUTO">Detect</option>{LAB_TIMEFRAMES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
            <Field label="Times are in" hint="Offset of the clock used in the file."><Select name="utcOffsetHours" defaultValue="0"><option value="0">UTC</option><option value="1">Lagos (UTC+1)</option><option value="2">Broker (UTC+2)</option><option value="3">Broker (UTC+3)</option><option value="-5">New York (UTC−5)</option></Select></Field>
          </div>
          <Msg s={s1} />
          <Button disabled={p1}>{p1 ? "Importing…" : "Upload"}</Button>
        </form>
      </Card>
      <Card>
        <CardHeader title="Synthetic demo data" hint="Random-walk candles for trying the tools. NOT real prices." />
        <form action={a2} className="space-y-3 p-4">
          <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">Synthetic data is for learning the tools only. It never reflects a real market, and tests on it can&apos;t be used as marketplace evidence.</p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Instrument"><Select name="symbol">{INSTRUMENT_PRESETS.map((p) => <option key={p.symbol}>{p.symbol}</option>)}</Select></Field>
            <Field label="Timeframe"><Select name="timeframe" defaultValue="H1">{["M15", "H1", "H4"].map((t) => <option key={t}>{t}</option>)}</Select></Field>
            <Field label="Days"><Input name="days" inputMode="numeric" defaultValue={240} /></Field>
          </div>
          <Msg s={s2} />
          <Button variant="secondary" disabled={p2}>{p2 ? "Creating…" : "Generate"}</Button>
        </form>
      </Card>
    </div>
  );
}

export function TvImportForm({ strategies }: { strategies: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(importTvAction as Act, {});
  return (
    <form action={action} className="space-y-3">
      <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">RiskPilot cannot run Pine Script. If you backtested in TradingView, export the Strategy Tester &ldquo;List of trades&rdquo; as CSV and import it here for analysis. These results are shown as <b>imported and unverified</b>.</p>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Trade list CSV" className="md:col-span-2"><Input type="file" name="file" accept=".csv,text/csv" className="h-auto py-2" required /></Field>
        <Field label="Name"><Input name="name" placeholder="Gold Sniper V1 — TradingView export" /></Field>
        <Field label="Strategy (optional)"><Select name="strategyId" defaultValue=""><option value="">None</option>{strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label="Instrument"><Select name="symbol">{INSTRUMENT_PRESETS.map((p) => <option key={p.symbol}>{p.symbol}</option>)}</Select></Field>
        <Field label="Timeframe"><Select name="timeframe" defaultValue="H1">{LAB_TIMEFRAMES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Starting balance"><Input name="initialBalance" inputMode="decimal" defaultValue={10000} /></Field>
        <Field label="Assumed risk per trade (%)" hint="Used only to express results in R. TradingView's export doesn't contain your stop distance."><Input name="assumedRiskPercent" inputMode="decimal" defaultValue={1} /></Field>
        <Field label="Times in the file are in"><Select name="utcOffsetHours" defaultValue="0"><option value="0">UTC</option><option value="1">Lagos (UTC+1)</option></Select></Field>
      </div>
      <Msg s={state} />
      <Button disabled={pending}>{pending ? "Importing…" : "Import results"}</Button>
    </form>
  );
}
