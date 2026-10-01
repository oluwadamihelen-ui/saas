import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { AssumptionsPanel, SimulationBanner, StatsGrid } from "@/components/lab/report-view";
import { EquityChart } from "@/components/charts";
import { getUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import type { Report } from "@/lib/lab/report";
import type { BacktestConfig } from "@/lib/lab/types";
import { pct, rFmt } from "@/lib/utils";

export const metadata: Metadata = { title: "Walk-forward" };

const fmtPf = (v: number | null) => (v === null ? "—" : v === Infinity ? "∞" : v.toFixed(2));

export default async function WalkForwardPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const user = await getUser();
  const runs = await prisma.backtestRun.findMany({ where: { groupId, userId: user.id, kind: "WALK_FORWARD" }, include: { strategy: { select: { name: true } } } });
  const a = runs.find((r) => r.sampleType === "IN_SAMPLE"), b = runs.find((r) => r.sampleType === "OUT_OF_SAMPLE");
  if (!a || !b) notFound();
  const ra = a.report as unknown as Report, rb = b.report as unknown as Report;
  const ca = a.config as unknown as BacktestConfig, cb = b.config as unknown as BacktestConfig;
  const rows: [string, (s: Report["stats"]) => string][] = [
    ["Trades", (s) => String(s.trades)], ["Win rate", (s) => pct(s.winRate, 1)], ["Profit factor", (s) => fmtPf(s.profitFactor)], ["Average R", (s) => rFmt(s.avgR)],
    ["Total R", (s) => rFmt(s.totalR)], ["Max drawdown", (s) => pct(s.maxDrawdownPercent)], ["Net P&L %", (s) => pct(s.netPnlPercent, 1)],
  ];
  const day = (t: number) => new Date(t).toISOString().slice(0, 10);
  return (
    <>
      <PageHeader title="Walk-forward test" subtitle={`${a.strategy?.name ?? ""} · fixed parameters ${Object.entries(ca.params ?? {}).map(([k, v]) => `${k}=${v}`).join(", ") || "(none)"}`} />
      <div className="space-y-5">
        <SimulationBanner synthetic={a.synthetic} />
        <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">Results from the optimization (in-sample) period and from the later out-of-sample period are shown separately and side by side. Differences between them are shown without interpretation.</p>
        <Card>
          <CardHeader title="Side by side" />
          <table className="w-full text-sm"><thead className="text-left text-xs uppercase tracking-wider text-muted"><tr><th className="px-4 py-2 font-semibold">Metric</th><th className="px-4 py-2 font-semibold">In-sample<br /><span className="font-normal normal-case">{day(ca.fromTs)} → {day(ca.toTs)}</span></th><th className="px-4 py-2 font-semibold">Out-of-sample<br /><span className="font-normal normal-case">{day(cb.fromTs)} → {day(cb.toTs)}</span></th></tr></thead>
            <tbody className="divide-y divide-line">{rows.map(([label, f]) => <tr key={label}><td className="px-4 py-2 text-muted">{label}</td><td className="num px-4 py-2">{f(ra.stats)}</td><td className="num px-4 py-2">{f(rb.stats)}</td></tr>)}</tbody></table>
        </Card>
        <div className="grid gap-5 lg:grid-cols-2">
          {[{ r: ra, run: a, t: "In-sample (optimization period)" }, { r: rb, run: b, t: "Out-of-sample" }].map(({ r, run, t }) => (
            <div key={t} className="space-y-4">
              <h2 className="text-sm font-semibold">{t}</h2>
              <Card><div className="p-3"><EquityChart data={r.equity.map((p) => ({ label: p.t ? day(p.t) : "Start", equity: Number(p.equity.toFixed(2)) }))} /></div></Card>
              <StatsGrid report={r} currency={(run.config as unknown as BacktestConfig).accountCurrency} />
              <AssumptionsPanel config={run.config as unknown as BacktestConfig} dataSource={run.dataSource} sampleType={run.sampleType} tradeCount={run.tradeCount} synthetic={run.synthetic} />
              <Link href={`/lab/runs/${run.id}`} className="text-sm text-accent hover:underline">Full report →</Link>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
