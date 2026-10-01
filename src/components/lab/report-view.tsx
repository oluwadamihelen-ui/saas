import { AlertTriangle, FlaskConical } from "lucide-react";
import { Badge, Card, CardHeader, Stat } from "@/components/ui";
import { DrawdownChart, EquityChart, GroupBarChart } from "@/components/charts";
import { assumptionRows, EXECUTION_MODEL_NOTE } from "@/lib/lab/assumptions";
import { REPORT_LABEL, SYNTHETIC_LABEL, SMALL_SAMPLE_TRADES, type GroupStats, type Report } from "@/lib/lab/report";
import type { BacktestConfig } from "@/lib/lab/types";
import { cn, money, pct, rFmt } from "@/lib/utils";

const fmtPf = (v: number | null) => (v === null ? "—" : v === Infinity ? "∞" : v.toFixed(2));
const day = (t: number) => new Date(t).toISOString().slice(0, 10);

export function SimulationBanner({ synthetic, imported }: { synthetic?: boolean; imported?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm">
        <FlaskConical size={18} className="mt-0.5 shrink-0 text-accent" />
        <div><Badge tone="accent" className="mb-1">Historical simulation</Badge><p className="text-fg/90">{REPORT_LABEL}</p></div>
      </div>
      {synthetic && <p className="flex gap-2 rounded-xl bg-warn-soft px-4 py-3 text-sm font-medium text-warn"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{SYNTHETIC_LABEL}</p>}
      {imported && <p className="flex gap-2 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn"><AlertTriangle size={16} className="mt-0.5 shrink-0" />Imported from TradingView. RiskPilot did not run this test and cannot verify it; R multiples assume the fixed risk you entered.</p>}
    </div>
  );
}

/** Every assumption, always. There is deliberately no option to hide any of these rows. */
export function AssumptionsPanel({ config, dataSource, sampleType, tradeCount, synthetic, imported }: { config: BacktestConfig; dataSource: string; sampleType: string; tradeCount: number; synthetic: boolean; imported?: boolean }) {
  const rows = assumptionRows({ config, dataSource, sampleType, tradeCount, synthetic, imported });
  return (
    <Card>
      <CardHeader title="Test assumptions" hint="These settings produced the numbers on this page. Change any of them and the results change." />
      <dl className="grid gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-2">
        {rows.map((r) => <div key={r.label}><dt className="text-xs text-muted">{r.label}</dt><dd className={cn("mt-0.5", r.label === "Data source" && synthetic && "font-semibold text-warn", r.label === "Sample" && sampleType === "OUT_OF_SAMPLE" && "font-medium text-accent")}>{r.value}</dd></div>)}
      </dl>
      {!imported && <p className="border-t border-line px-4 py-3 text-xs text-muted">{EXECUTION_MODEL_NOTE}</p>}
    </Card>
  );
}

export function GroupTable({ title, rows, hint, valueLabel = "Total R" }: { title: string; rows: GroupStats[]; hint?: string; valueLabel?: string }) {
  return (
    <Card>
      <CardHeader title={title} hint={hint} />
      {rows.length === 0 ? <p className="p-4 text-sm text-muted">No trades.</p> : (
        <>
          <div className="px-2 pt-3"><GroupBarChart data={rows.map((r) => ({ key: r.key, value: Number(r.totalR.toFixed(2)) }))} valueKey={valueLabel} suffix="R" /></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted"><tr><th className="px-4 py-2 font-semibold">Group</th><th className="px-2 py-2 font-semibold">Trades</th><th className="px-2 py-2 font-semibold">Win %</th><th className="px-2 py-2 font-semibold">Avg R</th><th className="px-2 py-2 font-semibold">Total R</th><th className="px-2 py-2 font-semibold">PF</th><th className="px-4 py-2 text-right font-semibold">Max DD</th></tr></thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td className="px-4 py-2 font-medium">{r.key}</td><td className="num px-2 py-2">{r.trades}</td><td className="num px-2 py-2">{r.winRate.toFixed(0)}%</td>
                    <td className="num px-2 py-2">{rFmt(r.avgR)}</td><td className="num px-2 py-2">{rFmt(r.totalR)}</td><td className="num px-2 py-2">{fmtPf(r.profitFactor)}</td><td className="num px-4 py-2 text-right">{pct(r.maxDrawdownPercent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

export function StatsGrid({ report, currency }: { report: Report; currency: string }) {
  const s = report.stats;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat label="Total trades" value={s.trades} sub={`${s.longs} long · ${s.shorts} short`} />
      <Stat label="Win rate" value={pct(s.winRate, 1)} sub={`${s.wins}W · ${s.losses}L`} />
      <Stat label="Profit factor" value={fmtPf(s.profitFactor)} hint="Gross profit divided by gross loss over the tested period." />
      <Stat label="Average R" value={rFmt(s.avgR)} hint="Average result per trade in R. 1R = the amount risked on that trade." />
      <Stat label="Total R" value={rFmt(s.totalR)} />
      <Stat label="Net P&L" value={money(s.netPnl, currency, { sign: true, decimals: 2 })} sub={pct(s.netPnlPercent, 1)} />
      <Stat label="Max drawdown" value={pct(s.maxDrawdownPercent)} sub={money(s.maxDrawdownAmount, currency, { decimals: 2 })} hint="Largest peak-to-trough fall of the simulated balance." />
      <Stat label="Avg bars held" value={s.avgBarsHeld === null ? "—" : s.avgBarsHeld.toFixed(1)} />
      <Stat label="Average win" value={money(s.avgWin, currency, { decimals: 2 })} />
      <Stat label="Average loss" value={money(s.avgLoss, currency, { decimals: 2 })} />
      <Stat label="Largest win" value={money(s.largestWin, currency, { sign: true, decimals: 2 })} />
      <Stat label="Largest loss" value={money(s.largestLoss, currency, { decimals: 2 })} />
      <Stat label="Winning streak" value={s.maxWinStreak} sub="longest" />
      <Stat label="Losing streak" value={s.maxLossStreak} sub="longest" />
    </div>
  );
}

/** Full report: stats, equity & drawdown curves, breakdowns. Neutral wording throughout. */
export function ReportView({ report, currency = "USD", compact = false, by = "session" }: { report: Report; currency?: string; compact?: boolean; by?: string }) {
  const eq = report.equity.map((p) => ({ label: p.t ? day(p.t) : "Start", equity: Number(p.equity.toFixed(2)) }));
  const dd = report.drawdown.map((p, i) => ({ label: report.equity[Math.min(i, report.equity.length - 1)]?.t ? day(report.equity[Math.min(i, report.equity.length - 1)].t) : "", dd: p.dd }));
  return (
    <div className="space-y-5">
      {report.smallSample && <p className="flex gap-2 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn"><AlertTriangle size={16} className="mt-0.5 shrink-0" />Only {report.stats.trades} trades (fewer than {SMALL_SAMPLE_TRADES}). Statistics from small samples can change a lot with a few more trades.</p>}
      <StatsGrid report={report} currency={currency} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card><CardHeader title="Equity curve" hint="Simulated account balance after each trade." /><div className="p-3"><EquityChart data={eq} /></div></Card>
        <Card><CardHeader title="Drawdown curve" hint="How far below the previous peak the simulated balance was after each trade." /><div className="p-3"><DrawdownChart data={dd} /></div></Card>
      </div>
      {!compact && (
        <>
          <div className="flex flex-wrap gap-2 text-sm">
            {[["session", "Session"], ["hours", "Time of day (UTC)"], ["weekday", "Day of week"], ["direction", "Long / short"], ["month", "Month"]].map(([k, label]) => (
              <a key={k} href={`?by=${k}`} className={cn("rounded-lg border px-3 py-1.5", by === k ? "border-accent bg-accent-soft" : "border-line text-muted hover:text-fg")}>{label}</a>
            ))}
          </div>
          {by === "session" && <GroupTable title="By session" rows={report.sessions} hint="Sessions use fixed UTC hours: Asian 00–07, London 07–13, London/NY overlap 13–16, New York 16–21, Off-hours 21–24. Trades are grouped by entry time." />}
          {by === "hours" && <GroupTable title="By time of day (UTC hour of entry)" rows={report.hours} />}
          {by === "weekday" && <GroupTable title="By day of week (UTC)" rows={report.weekdays} />}
          {by === "direction" && <GroupTable title="Long vs short" rows={report.directions} />}
          {by === "month" && <GroupTable title="Monthly performance" rows={report.monthly} />}
          <GroupTable title="By instrument" rows={report.instruments} />
        </>
      )}
    </div>
  );
}
