"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Badge, Button, Card, CardHeader, Field, Input, Select } from "@/components/ui";
import { importTradesAction, type ImportPreview } from "@/actions/import";
import { cn, price } from "@/lib/utils";

export function ImportForm({ currency, limited }: { currency: string; limited: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [offset, setOffset] = useState("1");
  const [dayFirst, setDayFirst] = useState("yes");
  const [costs, setCosts] = useState("no");
  const [fx, setFx] = useState("");
  const [res, setRes] = useState<ImportPreview | null>(null);
  const [pending, start] = useTransition();

  function run(mode: "preview" | "commit") {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file); fd.set("mode", mode); fd.set("utcOffsetHours", offset); fd.set("dayFirst", dayFirst); fd.set("includeCosts", costs);
    if (fx) fd.set("fxRate", fx);
    start(async () => setRes(await importTradesAction(fd)));
  }

  return (
    <div className="space-y-5">
      <Card className="p-4 md:p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="CSV file" className="md:col-span-2"><Input type="file" accept=".csv,text/csv,text/plain" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRes(null); }} className="h-auto py-2" /></Field>
          <Field label="Times in the file are in" hint="MT5 exports use your broker's server time (often UTC+2 or +3). Pick the one that matches so trades land on the right day.">
            <Select value={offset} onChange={(e) => { setOffset(e.target.value); setRes(null); }}>
              <option value="1">Lagos (UTC+1)</option><option value="0">UTC</option><option value="2">Broker server, winter (UTC+2)</option><option value="3">Broker server, summer (UTC+3)</option><option value="-5">New York (UTC−5)</option>
            </Select>
          </Field>
          <Field label="Dates like 01/09/2026 mean"><Select value={dayFirst} onChange={(e) => { setDayFirst(e.target.value); setRes(null); }}><option value="yes">1 September (day first)</option><option value="no">9 January (month first)</option></Select></Field>
          <Field label="P&L"><Select value={costs} onChange={(e) => { setCosts(e.target.value); setRes(null); }}><option value="no">Use the Profit column as-is</option><option value="yes">Add commission and swap</option></Select></Field>
          <Field label={`USD → ${currency} rate`} hint="Only used to estimate risk for forex/gold rows when the file has no risk amount and your account isn't in USD."><Input inputMode="decimal" value={fx} onChange={(e) => setFx(e.target.value)} placeholder="auto" disabled={currency === "USD"} /></Field>
        </div>
        <div className="mt-5 flex gap-3"><Button onClick={() => run("preview")} disabled={!file || pending}>{pending ? "Reading…" : "Preview"}</Button></div>
      </Card>

      {res && !res.ok && <p role="alert" className="rounded-lg bg-down-soft px-4 py-3 text-sm text-down">{res.error}</p>}

      {res?.committed && (
        <Card className="p-6 text-center"><h2 className="text-lg font-semibold">Imported {res.imported} trades</h2><p className="mt-1 text-sm text-muted">They now count in your analytics and daily records.</p><Link href="/journal" className="mt-4 inline-block text-accent hover:underline">View journal</Link></Card>
      )}

      {res?.ok && !res.committed && (
        <Card>
          <CardHeader title="Preview" action={<Button onClick={() => run("commit")} disabled={pending || !res.importable}>{pending ? "Importing…" : `Import ${res.importable} trades`}</Button>} />
          <div className="grid grid-cols-2 gap-3 p-4 text-sm md:grid-cols-4">
            <S k="Will import" v={res.importable} tone="up" /><S k="Already imported" v={res.duplicates} /><S k="Skipped" v={res.skipped} tone={res.skipped ? "warn" : undefined} /><S k="Over plan limit" v={res.overLimit} tone={res.overLimit ? "down" : undefined} />
          </div>
          {!!res.estimatedRisk && <p className="mx-4 mb-3 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">For {res.estimatedRisk} trades the file had no risk amount, so risk was estimated from your stop loss and common contract specs. Treat those risk figures and R multiples as estimates.</p>}
          {!!res.overLimit && limited && <p className="mx-4 mb-3 rounded-lg bg-down-soft px-3 py-2 text-xs text-down">The Free plan stores up to its trade limit; {res.overLimit} trades won&apos;t be imported. <Link href="/billing" className="underline">Upgrade for unlimited</Link>.</p>}
          {res.sample && res.sample.length > 0 && (
            <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead className="text-left text-xs uppercase tracking-wider text-muted"><tr>{["Date", "Instrument", "Side", "Entry", "Lots", "Risk", "P&L"].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">{res.sample.map((s, i) => <tr key={i}><td className="px-4 py-2 text-muted">{s.openedAt.slice(0, 16).replace("T", " ")}</td><td className="px-4 py-2 font-medium">{s.instrument}</td><td className="px-4 py-2"><Badge tone={s.direction === "LONG" ? "up" : "down"}>{s.direction === "LONG" ? "Long" : "Short"}</Badge></td><td className="num px-4 py-2">{price(s.entry)}</td><td className="num px-4 py-2">{s.lots}</td><td className="num px-4 py-2">{s.risk.toFixed(2)}</td><td className={cn("num px-4 py-2", s.pnl === null ? "text-muted" : s.pnl >= 0 ? "text-up" : "text-down")}>{s.pnl ?? "—"}</td></tr>)}</tbody></table></div>
          )}
          {res.errors && res.errors.length > 0 && (
            <details className="border-t border-line"><summary className="cursor-pointer px-4 py-3 text-sm text-muted">Skipped rows ({res.skipped})</summary><ul className="space-y-1 px-4 pb-4 text-xs text-muted">{res.errors.map((e) => <li key={e.line}>Line {e.line}: {e.error}</li>)}</ul></details>
          )}
        </Card>
      )}

      <Card className="p-4 text-sm text-muted">
        <p className="font-medium text-fg">What the file needs</p>
        <p className="mt-1">A header row with date/time, symbol, buy/sell, entry price, lots, and a stop loss. Profit/P&L, take profit, ticket/position id and risk amount are used when present. Rows without a stop loss are skipped — RiskPilot can&apos;t work out risk without one. Re-importing the same file is safe: trades already imported are detected and skipped.</p>
      </Card>
    </div>
  );
}

function S({ k, v, tone }: { k: string; v?: number; tone?: "up" | "warn" | "down" }) {
  return <div><div className="text-xs text-muted">{k}</div><div className={cn("num text-xl font-semibold", tone === "up" && "text-up", tone === "warn" && "text-warn", tone === "down" && "text-down")}>{v ?? 0}</div></div>;
}
