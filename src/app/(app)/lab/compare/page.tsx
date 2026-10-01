import type { Metadata } from "next";
import { Card, CardHeader, PageHeader, Badge } from "@/components/ui";
import { getUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import type { Stats } from "@/lib/lab/report";
import type { BacktestConfig } from "@/lib/lab/types";
import { fmtDate, pct, rFmt } from "@/lib/utils";

export const metadata: Metadata = { title: "Compare tests" };

const fmtPf = (v: number | null) => (v === null ? "—" : v === Infinity ? "∞" : v.toFixed(2));
const day = (t: number) => new Date(t).toISOString().slice(0, 10);

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string | string[] }> }) {
  const sp = await searchParams;
  const user = await getUser();
  const ids = (Array.isArray(sp.ids) ? sp.ids : sp.ids ? [sp.ids] : []).slice(0, 4);
  const all = await prisma.backtestRun.findMany({ where: { userId: user.id, kind: { in: ["SINGLE", "WALK_FORWARD", "IMPORTED"] } }, orderBy: { createdAt: "desc" }, take: 60, select: { id: true, label: true, kind: true, sampleType: true, createdAt: true, tradeCount: true, strategy: { select: { name: true } } } });
  const chosen = ids.length ? await prisma.backtestRun.findMany({ where: { userId: user.id, id: { in: ids } }, include: { strategy: { select: { name: true } } } }) : [];
  const ordered = ids.map((i) => chosen.find((c) => c.id === i)).filter(Boolean) as typeof chosen;
  const rows: [string, (r: (typeof chosen)[number]) => string][] = [
    ["Instrument / timeframe", (r) => { const c = r.config as unknown as BacktestConfig; return `${c.symbol} ${c.timeframe}`; }],
    ["Backtest period", (r) => { const c = r.config as unknown as BacktestConfig; return `${day(c.fromTs)} → ${day(c.toTs)}`; }],
    ["Sample", (r) => (r.sampleType === "FULL" ? "Full period" : r.sampleType === "IN_SAMPLE" ? "In-sample" : "Out-of-sample")],
    ["Data source", (r) => (r.synthetic ? "SYNTHETIC DEMO DATA" : r.dataSource)],
    ["Number of trades", (r) => String(r.tradeCount)],
    ["Profit factor", (r) => fmtPf((r.summary as unknown as Stats).profitFactor)],
    ["Average R", (r) => rFmt((r.summary as unknown as Stats).avgR)],
    ["Total R", (r) => rFmt((r.summary as unknown as Stats).totalR)],
    ["Max drawdown", (r) => pct((r.summary as unknown as Stats).maxDrawdownPercent)],
    ["Win rate", (r) => pct((r.summary as unknown as Stats).winRate, 1)],
    ["Risk per trade", (r) => `${(r.config as unknown as BacktestConfig).riskPercent}%`],
    ["Spread / slippage / commission", (r) => { const c = r.config as unknown as BacktestConfig; return r.kind === "IMPORTED" ? "as set in TradingView (unverified)" : `${c.spread} / ${c.slippage} / ${c.commissionPerLot}`; }],
  ];
  return (
    <>
      <PageHeader title="Compare tests" subtitle="Pick up to 4 tests. They are shown side by side — never ranked. You decide which characteristics matter to you." />
      <Card className="mb-5">
        <form className="p-4"><div className="max-h-56 space-y-1 overflow-auto">{all.map((r) => (
          <label key={r.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2"><input type="checkbox" name="ids" value={r.id} defaultChecked={ids.includes(r.id)} className="h-4 w-4 accent-blue-500" /><span>{r.strategy?.name ?? "Imported"} <span className="text-muted">· {r.label || r.kind.toLowerCase()} · {fmtDate(r.createdAt, user.timezone)} · {r.tradeCount} trades</span></span></label>
        ))}{all.length === 0 && <p className="text-sm text-muted">No tests yet.</p>}</div><button className="mt-3 h-10 rounded-lg bg-accent px-4 text-sm font-medium text-white">Compare</button></form>
      </Card>
      {ordered.length >= 2 && (
        <Card className="overflow-x-auto">
          <CardHeader title="Documented historical test metrics" action={<Badge tone="accent">Historical simulation</Badge>} />
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted"><tr><th className="px-4 py-2 font-semibold">Metric</th>{ordered.map((r) => <th key={r.id} className="px-4 py-2 font-semibold normal-case text-fg">{r.strategy?.name ?? "Imported"}<br /><span className="text-xs font-normal text-muted">{r.label}</span></th>)}</tr></thead>
            <tbody className="divide-y divide-line">{rows.map(([label, f]) => <tr key={label}><td className="px-4 py-2 text-muted">{label}</td>{ordered.map((r) => <td key={r.id} className="num px-4 py-2">{f(r)}</td>)}</tr>)}</tbody>
          </table>
          <p className="border-t border-line px-4 py-3 text-xs text-muted">Differences in period, data, risk and costs affect every number above. Compare like with like. Historical results do not predict future performance.</p>
        </Card>
      )}
    </>
  );
}
