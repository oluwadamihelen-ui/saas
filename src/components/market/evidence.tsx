import { AlertTriangle } from "lucide-react";
import { Badge, Card, CardHeader } from "@/components/ui";
import { EquityChart } from "@/components/charts";
import { AssumptionsPanel } from "@/components/lab/report-view";
import type { BacktestConfig } from "@/lib/lab/types";
import type { Stats } from "@/lib/lab/report";
import { pct, rFmt } from "@/lib/utils";

const fmtPf = (v: number | null) => (v === null ? "—" : v === Infinity ? "∞" : v.toFixed(2));

export interface EvidenceView {
  id: string;
  note: string;
  run: { id: string; sampleType: string; label: string; config: unknown; dataSource: string; tradeCount: number; summary: unknown; report: unknown; createdAt: Date };
}

/** A public backtest. Always labelled a historical simulation, always with the complete assumptions. */
export function EvidenceCard({ e }: { e: EvidenceView }) {
  const stats = e.run.summary as Stats;
  const config = e.run.config as BacktestConfig;
  const rep = e.run.report as { equity?: { t: number; equity: number }[]; smallSample?: boolean };
  const small = e.run.tradeCount < 30;
  return (
    <Card>
      <CardHeader title={<span className="flex flex-wrap items-center gap-2">{e.run.label || "Backtest"}<Badge tone="accent">Historical simulation</Badge><Badge tone={e.run.sampleType === "OUT_OF_SAMPLE" ? "up" : e.run.sampleType === "IN_SAMPLE" ? "warn" : "neutral"}>{e.run.sampleType === "OUT_OF_SAMPLE" ? "Out-of-sample" : e.run.sampleType === "IN_SAMPLE" ? "In-sample" : "Full period"}</Badge></span>} />
      <div className="space-y-4 p-4">
        {e.note && <p className="text-sm text-muted">{e.note}</p>}
        {small && <p className="flex gap-2 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn"><AlertTriangle size={14} className="mt-0.5 shrink-0" />Small sample ({e.run.tradeCount} trades).</p>}
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {([["Trades", String(stats.trades)], ["Win rate", pct(stats.winRate, 1)], ["Profit factor", fmtPf(stats.profitFactor)], ["Average R", rFmt(stats.avgR)], ["Total R", rFmt(stats.totalR)], ["Max drawdown", pct(stats.maxDrawdownPercent)], ["Net P&L", pct(stats.netPnlPercent, 1)], ["Losing streak", String(stats.maxLossStreak)]] as const).map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="num mt-0.5 font-medium">{v}</dd></div>)}
        </dl>
        {rep.equity && rep.equity.length > 1 && <EquityChart data={rep.equity.map((p) => ({ label: p.t ? new Date(p.t).toISOString().slice(0, 10) : "Start", equity: Number(p.equity.toFixed(2)) }))} />}
        <AssumptionsPanel config={config} dataSource={e.run.dataSource} sampleType={e.run.sampleType} tradeCount={e.run.tradeCount} synthetic={e.run.dataSource.includes("SYNTHETIC")} />
        <p className="text-xs text-muted">Historical simulation — past data. This does not predict or guarantee future results, and live trading will differ (spreads, slippage, execution, market changes).</p>
      </div>
    </Card>
  );
}
