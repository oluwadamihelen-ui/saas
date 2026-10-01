import type { Metadata } from "next";
import { Card, CardHeader, Empty, LinkButton, PageHeader, Stat, UpgradeNote, Badge } from "@/components/ui";
import { DrawdownChart, GroupBarChart } from "@/components/charts";
import { getContext } from "@/lib/session";
import { loadTrades, toAnalytics } from "@/lib/data";
import { breakdowns, equityPoints, generateInsights, groupBy, summarize, type GroupRow } from "@/lib/engine/analytics";
import { calculateDrawdown } from "@/lib/engine/risk";
import { money, pct, rFmt } from "@/lib/utils";

export const metadata: Metadata = { title: "Analytics" };

function Table({ title, rows, cur, hint }: { title: string; rows: GroupRow[]; cur: string; hint?: string }) {
  return (
    <Card>
      <CardHeader title={title} hint={hint} />
      {rows.length === 0 ? <p className="p-4 text-sm text-muted">No data yet.</p> : (
        <>
          <div className="px-2 pt-3"><GroupBarChart data={rows.map((r) => ({ key: r.key, value: r.pnl }))} valueKey="P&L" /></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted"><tr><th className="px-4 py-2 font-semibold">Group</th><th className="px-2 py-2 font-semibold">Trades</th><th className="px-2 py-2 font-semibold">Win %</th><th className="px-2 py-2 font-semibold">Avg R</th><th className="px-4 py-2 text-right font-semibold">P&L</th></tr></thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.key}><td className="px-4 py-2 font-medium">{r.key}</td><td className="num px-2 py-2">{r.trades}</td><td className="num px-2 py-2">{r.winRate.toFixed(0)}%</td><td className="num px-2 py-2">{rFmt(r.avgR)}</td><td className={`num px-4 py-2 text-right ${r.pnl >= 0 ? "text-up" : "text-down"}`}>{money(r.pnl, cur, { sign: true, decimals: 2 })}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

export default async function AnalyticsPage() {
  const { user, account, plan } = await getContext();
  const cur = account.currency;
  const trades = await loadTrades(user.id, account.id);
  const at = trades.map(toAnalytics);
  const s = summarize(at, account.startingBalance);
  if (s.trades === 0) return (<><PageHeader title="Analytics" /><Empty title="No closed trades yet" body="Analytics describe your past trading behaviour. Record a few trades with a result to see them." action={<LinkButton href="/journal/new">Record a trade</LinkButton>} /></>);

  const b = breakdowns(at, user.timezone);
  const pro = plan.limits.advancedAnalytics;
  const insights = pro ? generateInsights(at, account.startingBalance, new Date(), user.timezone) : [];
  const eq = equityPoints(at, account.startingBalance, user.timezone);
  const dd = calculateDrawdown(eq.map((p) => p.equity));
  const emotion = pro ? groupBy(at, (t) => t.emotionBefore) : [];
  const disc = pro ? groupBy(at, (t) => (t.checklistScore === null || t.checklistScore === undefined ? null : t.checklistScore >= 80 ? "Discipline 80%+" : "Discipline <80%")) : [];

  return (
    <>
      <PageHeader title="Analytics" subtitle="A look back at how you have traded. This describes the past — it is not a prediction or advice." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Trades" value={s.trades} sub={`${s.wins}W · ${s.losses}L · ${s.breakeven}BE`} />
        <Stat label="Win rate" value={pct(s.winRate, 0)} sub={`Loss rate ${pct(s.lossRate, 0)}`} />
        <Stat label="Total P&L" value={money(s.totalPnl, cur, { sign: true, decimals: 2 })} tone={s.totalPnl >= 0 ? "up" : "down"} />
        <Stat label="Profit factor" value={s.profitFactor === null ? "—" : s.profitFactor === Infinity ? "∞" : s.profitFactor.toFixed(2)} hint="Total money won divided by total money lost. Above 1 means winners outweighed losers." />
        <Stat label="Average win" value={money(s.avgWin, cur, { decimals: 2 })} tone="up" />
        <Stat label="Average loss" value={money(s.avgLoss, cur, { decimals: 2 })} tone="down" />
        <Stat label="Average R" value={rFmt(s.avgR)} hint="R is the amount you risked. +1R means you made as much as you risked." />
        <Stat label="Expectancy" value={rFmt(s.expectancyR)} sub="average result per trade" hint="Your average result per trade in R, based on your history." />
        <Stat label="Best trade" value={money(s.best, cur, { sign: true, decimals: 2 })} tone="up" />
        <Stat label="Worst trade" value={money(s.worst, cur, { sign: true, decimals: 2 })} tone="down" />
        <Stat label="Avg risk / trade" value={pct(s.avgRisk, 2)} sub={s.avgRiskLosses !== null && s.avgRiskWins !== null ? `Winners ${s.avgRiskWins.toFixed(1)}% · Losers ${s.avgRiskLosses.toFixed(1)}%` : undefined} />
        <Stat label="Max drawdown" value={pct(s.maxDrawdownPercent)} sub={money(s.maxDrawdownAmount, cur, { decimals: 2 })} tone={s.maxDrawdownPercent > 10 ? "warn" : undefined} />
        <Stat label="Win streak" value={s.maxWinStreak} sub="longest" />
        <Stat label="Losing streak" value={s.maxLossStreak} sub="longest" />
        <Stat label="Current streak" value={s.currentStreak.length ? `${s.currentStreak.length} ${s.currentStreak.type === "WIN" ? "W" : "L"}` : "—"} />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-muted">What your history says</h2>
      {pro ? (
        <Card className="divide-y divide-line">
          {insights.map((i, k) => <p key={k} className="flex items-start gap-3 px-4 py-3 text-sm"><Badge tone={i.tone === "warn" ? "warn" : "neutral"}>{i.tone === "warn" ? "Watch" : "Note"}</Badge>{i.text}</p>)}
        </Card>
      ) : <UpgradeNote feature="Behaviour insights compare your risk on winners vs losers, after losses, and more." />}

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Table title="By instrument" rows={b.instrument} cur={cur} />
        <Table title="Long vs short" rows={b.direction} cur={cur} />
        {pro ? (
          <>
            <Table title="By setup" rows={b.setup} cur={cur} />
            <Table title="By trading session" rows={b.session} cur={cur} />
            <Table title="By day of week" rows={b.weekday} cur={cur} />
            <Table title="By risk per trade" rows={b.risk} cur={cur} hint="Do bigger risks help or hurt? This groups your trades by the % of account risked." />
            <Table title="By month" rows={b.month} cur={cur} />
            <Table title="By emotion before the trade" rows={emotion} cur={cur} />
            <Table title="By pre-trade discipline score" rows={disc} cur={cur} hint="Trades where you completed 80%+ of your own checklist vs the rest." />
            <Card><CardHeader title="Drawdown curve" /><div className="p-3"><DrawdownChart data={eq.map((p, i) => ({ label: p.label, dd: Number(dd.series[i].toFixed(2)) }))} /></div></Card>
          </>
        ) : (
          <div className="lg:col-span-2"><UpgradeNote feature="Breakdowns by setup, session, weekday, risk size and month, plus drawdown analytics, are in Pro." /></div>
        )}
      </div>
    </>
  );
}
