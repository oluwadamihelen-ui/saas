"use client";
import { useMemo, useState, useTransition } from "react";
import { Copy, Check } from "lucide-react";
import { Button, Card, CardHeader, Field, Input } from "@/components/ui";
import { buildPineScript, type PineParams } from "@/lib/pine";
import { savePineToolAction } from "./actions";

const KEYS: [keyof PineParams, string, string?][] = [
  ["accountSize", "Account size"], ["riskPercent", "Risk %"], ["entry", "Entry price"], ["stopLoss", "Stop-loss price"], ["takeProfit", "Take-profit price"],
  ["valuePerPointPerLot", "Money per 1.0 price move, per lot", "XAUUSD with a 100 oz contract = 100. Check your broker's contract specification."], ["minLot", "Minimum lot"], ["lotStep", "Lot step"],
];

export function PineGenerator({ initial, saved }: { initial: PineParams; saved: { id: string; name: string; params: PineParams }[] }) {
  const [p, setP] = useState<Record<keyof PineParams, string>>(Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, String(v)])) as Record<keyof PineParams, string>);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const params = useMemo(() => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, Number(v)])) as unknown as PineParams, [p]);
  const code = useMemo(() => buildPineScript(params), [params]);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card>
        <CardHeader title="Pre-fill the indicator" />
        <div className="space-y-3 p-4">
          {KEYS.map(([k, label, hint]) => <Field key={k} label={label} hint={hint}><Input inputMode="decimal" value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} /></Field>)}
          <Button variant="secondary" className="w-full" disabled={pending} onClick={() => start(async () => { const r = await savePineToolAction(`Risk Box ${new Date().toLocaleDateString()}`, params); setMsg(r.ok ? "Saved." : r.error ?? "Could not save."); })}>Save this setup</Button>
          {msg && <p className="text-xs text-muted">{msg}</p>}
          {saved.length > 0 && <div className="border-t border-line pt-3"><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Saved setups</p>{saved.map((s) => <button key={s.id} className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-muted hover:bg-surface-2 hover:text-fg" onClick={() => setP(Object.fromEntries(Object.entries(s.params).map(([k, v]) => [k, String(v)])) as Record<keyof PineParams, string>)}>{s.name}</button>)}</div>}
        </div>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader title="Pine Script v5" action={<Button size="sm" onClick={copy}>{copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}</Button>} />
          <pre className="max-h-[520px] overflow-auto p-4 text-xs leading-relaxed text-muted"><code>{code}</code></pre>
        </Card>
        <Card className="p-4 text-sm text-muted">
          <p className="font-semibold text-fg">How to add it</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Open TradingView and the Pine Editor (bottom panel).</li>
            <li>Paste the code, click <b>Add to chart</b>.</li>
            <li>Change the inputs in the indicator settings any time.</li>
          </ol>
          <p className="mt-3 text-xs">This indicator only draws the levels you enter and calculates risk. It has no entry logic, gives no buy/sell signals, and does not predict the market. Position size depends on your broker&apos;s specification — always verify it.</p>
        </Card>
      </div>
    </div>
  );
}
