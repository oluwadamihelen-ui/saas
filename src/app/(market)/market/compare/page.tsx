import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader, PageHeader, Badge } from "@/components/ui";
import { compareEvidence, searchListings } from "@/lib/market/listings";
import type { Stats } from "@/lib/lab/report";
import type { BacktestConfig } from "@/lib/lab/types";
import { pct, rFmt } from "@/lib/utils";

export const metadata: Metadata = { title: "Compare indicators" };

const fmtPf = (v: number | null) => (v === null ? "—" : v === Infinity ? "∞" : v.toFixed(2));
const day = (t: number) => new Date(t).toISOString().slice(0, 10);

export default async function CompareMarket({ searchParams }: { searchParams: Promise<{ ids?: string | string[] }> }) {
  const sp = await searchParams;
  const ids = (Array.isArray(sp.ids) ? sp.ids : sp.ids ? sp.ids.split(",") : []).slice(0, 4);
  const [all, chosen] = await Promise.all([searchListings({}), ids.length ? compareEvidence(ids) : Promise.resolve([])]);
  const ordered = ids.map((i) => chosen.find((c) => c.id === i)).filter(Boolean) as typeof chosen;
  type Row = (typeof chosen)[number];
  const ev = (r: Row) => r.evidence[0]?.run;
  const rows: [string, (r: Row) => string][] = [
    ["Backtest period", (r) => { const e = ev(r); return e ? `${day((e.config as unknown as BacktestConfig).fromTs)} → ${day((e.config as unknown as BacktestConfig).toTs)}` : "No published backtest"; }],
    ["Sample", (r) => { const e = ev(r); return e ? (e.sampleType === "OUT_OF_SAMPLE" ? "Out-of-sample" : e.sampleType === "IN_SAMPLE" ? "In-sample" : "Full period") : "—"; }],
    ["Instrument / timeframe", (r) => { const e = ev(r); return e ? `${(e.config as unknown as BacktestConfig).symbol} ${(e.config as unknown as BacktestConfig).timeframe}` : "—"; }],
    ["Number of trades", (r) => (ev(r) ? String(ev(r)!.tradeCount) : "—")],
    ["Profit factor", (r) => (ev(r) ? fmtPf((ev(r)!.summary as unknown as Stats).profitFactor) : "—")],
    ["Average R", (r) => (ev(r) ? rFmt((ev(r)!.summary as unknown as Stats).avgR) : "—")],
    ["Max drawdown", (r) => (ev(r) ? pct((ev(r)!.summary as unknown as Stats).maxDrawdownPercent) : "—")],
    ["Win rate", (r) => (ev(r) ? pct((ev(r)!.summary as unknown as Stats).winRate, 1) : "—")],
    ["Risk per trade", (r) => (ev(r) ? `${(ev(r)!.config as unknown as BacktestConfig).riskPercent}%` : "—")],
    ["Spread / slippage / commission", (r) => { const e = ev(r); return e ? `${(e.config as unknown as BacktestConfig).spread} / ${(e.config as unknown as BacktestConfig).slippage} / ${(e.config as unknown as BacktestConfig).commissionPerLot}` : "—"; }],
    ["Data source", (r) => ev(r)?.dataSource ?? "—"],
  ];
  return (
    <>
      <PageHeader title="Compare indicators" subtitle="Side-by-side documented historical test metrics. Nothing is ranked — you decide which characteristics matter." />
      <Card className="mb-5"><form className="p-4"><div className="max-h-56 space-y-1 overflow-auto">{all.map((l) => <label key={l.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2"><input type="checkbox" name="ids" value={l.id} defaultChecked={ids.includes(l.id)} className="h-4 w-4 accent-blue-500" /><span>{l.title} <span className="text-muted">· {l.creator.displayName}</span></span></label>)}</div><button className="mt-3 h-10 rounded-lg bg-accent px-4 text-sm font-medium text-white">Compare</button> <span className="ml-2 text-xs text-muted">Up to 4</span></form></Card>
      {ordered.length >= 2 && (
        <Card className="overflow-x-auto">
          <CardHeader title="Documented historical test metrics" action={<Badge tone="accent">Historical simulation</Badge>} />
          <table className="w-full min-w-[560px] text-sm"><thead className="text-left text-xs uppercase tracking-wider text-muted"><tr><th className="px-4 py-2 font-semibold">Metric</th>{ordered.map((r) => <th key={r.id} className="px-4 py-2 font-semibold normal-case text-fg"><Link href={`/market/${r.slug}`} className="hover:underline">{r.title}</Link><br /><span className="text-xs font-normal text-muted">{r.creator.displayName}</span></th>)}</tr></thead>
            <tbody className="divide-y divide-line">{rows.map(([label, f]) => <tr key={label}><td className="px-4 py-2 text-muted">{label}</td>{ordered.map((r) => <td key={r.id} className="num px-4 py-2">{f(r)}</td>)}</tr>)}</tbody></table>
          <p className="border-t border-line px-4 py-3 text-xs text-muted">Periods, data, risk and costs differ between listings, so numbers are not directly comparable unless the assumptions match. Historical simulations do not predict or guarantee future results.</p>
        </Card>
      )}
    </>
  );
}
