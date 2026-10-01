import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Badge, Button, Card, CardHeader, LinkButton, PageHeader } from "@/components/ui";
import { AssumptionsPanel, ReportView, SimulationBanner } from "@/components/lab/report-view";
import { getUser } from "@/lib/session";
import { getOwnedRun } from "@/lib/lab/service";
import { OVERFIT_WARNING, type Report, type Stats } from "@/lib/lab/report";
import type { BacktestConfig } from "@/lib/lab/types";
import { deleteRunAction } from "@/actions/lab";
import { fmtDate, money, pct, rFmt } from "@/lib/utils";

export const metadata: Metadata = { title: "Backtest report" };

const fmtPf = (v: number | null) => (v === null ? "—" : v === Infinity ? "∞" : v.toFixed(2));

export default async function RunPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ by?: string }> }) {
  const { id } = await params;
  const { by } = await searchParams;
  const user = await getUser();
  const run = await getOwnedRun(user.id, id);
  if (!run) notFound();
  const config = run.config as unknown as BacktestConfig;
  const title = run.label || (run.kind === "OPTIMIZATION" ? "Parameter test" : "Backtest");

  if (run.kind === "OPTIMIZATION") {
    const rep = run.report as unknown as { rows: { params: Record<string, number>; stats: Stats; error?: string }[] };
    const names = [...new Set(rep.rows.flatMap((r) => Object.keys(r.params)))];
    return (
      <>
        <PageHeader title={title} subtitle={`${run.strategy?.name ?? ""} · ${rep.rows.length} configurations · ${fmtDate(run.createdAt, user.timezone)}`} />
        <div className="space-y-4">
          <SimulationBanner synthetic={run.synthetic} />
          <p role="alert" className="flex gap-2 rounded-xl bg-warn-soft px-4 py-3 text-sm font-medium text-warn"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{OVERFIT_WARNING}</p>
          <Card className="overflow-x-auto">
            <CardHeader title="Historical statistics by configuration" hint="Shown in the order you entered them. RiskPilot does not rank or label any configuration." />
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted"><tr>{names.map((n) => <th key={n} className="px-4 py-2 font-semibold">{n}</th>)}{["Trades", "Win %", "PF", "Avg R", "Total R", "Max DD", "Net P&L", ""].map((h) => <th key={h} className="px-2 py-2 font-semibold">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">{rep.rows.map((r, i) => (
                <tr key={i}>
                  {names.map((n) => <td key={n} className="num px-4 py-2 font-medium">{r.params[n] ?? "—"}</td>)}
                  <td className="num px-2 py-2">{r.stats.trades}</td><td className="num px-2 py-2">{r.stats.winRate.toFixed(0)}%</td><td className="num px-2 py-2">{fmtPf(r.stats.profitFactor)}</td>
                  <td className="num px-2 py-2">{rFmt(r.stats.avgR)}</td><td className="num px-2 py-2">{rFmt(r.stats.totalR)}</td><td className="num px-2 py-2">{pct(r.stats.maxDrawdownPercent)}</td><td className="num px-2 py-2">{money(r.stats.netPnl, config.accountCurrency, { sign: true, decimals: 0 })}</td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">{run.strategy && <><Link className="text-xs text-accent hover:underline" href={`/lab/strategies/${run.strategy.id}/test?${new URLSearchParams(Object.entries(r.params).map(([k, v]) => [`p_${k}`, String(v)]))}`}>Run</Link><span className="mx-1.5 text-muted">·</span><Link className="text-xs text-accent hover:underline" href={`/lab/strategies/${run.strategy.id}/walkforward?${new URLSearchParams(Object.entries(r.params).map(([k, v]) => [`p_${k}`, String(v)]))}`}>Walk-forward</Link></>}</td>
                </tr>
              ))}</tbody>
            </table>
          </Card>
          <AssumptionsPanel config={config} dataSource={run.dataSource} sampleType="FULL" tradeCount={rep.rows.reduce((a, r) => a + r.stats.trades, 0)} synthetic={run.synthetic} />
        </div>
      </>
    );
  }

  const report = run.report as unknown as Report & { warnings?: string[] };
  const sibling = run.groupId ? `/lab/walkforward/${run.groupId}` : null;
  return (
    <>
      <PageHeader title={title} subtitle={`${run.strategy?.name ?? "Imported"} · ${fmtDate(run.createdAt, user.timezone)}`}
        action={<div className="flex gap-2">{sibling && <LinkButton href={sibling} variant="secondary" size="sm">In- vs out-of-sample</LinkButton>}<form action={deleteRunAction}><input type="hidden" name="id" value={run.id} /><Button variant="ghost" size="sm">Delete</Button></form></div>} />
      <div className="space-y-5">
        <SimulationBanner synthetic={run.synthetic} imported={run.kind === "IMPORTED"} />
        {run.sampleType !== "FULL" && <Badge tone="accent" className="text-xs">{run.sampleType === "IN_SAMPLE" ? "In-sample (optimization period)" : "Out-of-sample"}</Badge>}
        {report.warnings?.map((w) => <p key={w} className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{w}</p>)}
        <ReportView report={report} currency={config.accountCurrency} by={by} compact={run.kind === "IMPORTED" ? false : false} />
        <AssumptionsPanel config={config} dataSource={run.dataSource} sampleType={run.sampleType} tradeCount={run.tradeCount} synthetic={run.synthetic} imported={run.kind === "IMPORTED"} />
        <Card>
          <CardHeader title={`Trades (${Math.min(report.trades.length, 100)} of ${run.tradeCount})`} />
          <div className="max-h-96 overflow-auto"><table className="w-full min-w-[640px] text-sm"><thead className="sticky top-0 bg-surface text-left text-xs uppercase tracking-wider text-muted"><tr>{["Entry", "Side", "Session", "Result", "R", "Exit reason"].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">{report.trades.slice(0, 100).map((t, i) => <tr key={i}><td className="num px-4 py-2 text-muted">{new Date(t.entryTime).toISOString().slice(0, 16).replace("T", " ")}</td><td className="px-4 py-2"><Badge tone={t.direction === "LONG" ? "up" : "down"}>{t.direction === "LONG" ? "Long" : "Short"}</Badge></td><td className="px-4 py-2 text-muted">{t.session}</td><td className={`num px-4 py-2 ${t.pnl >= 0 ? "text-up" : "text-down"}`}>{money(t.pnl, config.accountCurrency, { sign: true, decimals: 2 })}</td><td className="num px-4 py-2">{rFmt(t.r)}</td><td className="px-4 py-2 text-muted">{t.reason?.replace("_", " ") ?? "—"}</td></tr>)}</tbody></table></div>
        </Card>
      </div>
    </>
  );
}
