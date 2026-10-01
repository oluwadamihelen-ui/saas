import type { Metadata } from "next";
import Link from "next/link";
import { Calculator } from "lucide-react";
import { Card, CardHeader, Disclaimer, Empty, LinkButton, PageHeader, Stat, UpgradeNote, Badge } from "@/components/ui";
import { DistributionChart, DrawdownChart, EquityChart, PnlByDayChart, RiskPerTradeChart } from "@/components/charts";
import { GuardrailCard } from "@/components/guardrail-card";
import { getContext } from "@/lib/session";
import { currentBalance, guardrailFor, loadTrades, toAnalytics } from "@/lib/data";
import { equityPoints, generateInsights, pnlByDay, rDistribution } from "@/lib/engine/analytics";
import { calculateDrawdown } from "@/lib/engine/risk";
import { fmtDate, money, pct, rFmt } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const ctx = await getContext();
  const { account, plan, user } = ctx;
  const cur = account.currency;
  const trades = await loadTrades(user.id, account.id);
  const at = trades.map(toAnalytics);
  const closed = at.filter((t) => t.result !== "OPEN");
  const balance = currentBalance(account.startingBalance, trades);
  const { todays, status: g } = guardrailFor(ctx, trades);
  const pnlToday = todays.reduce((a, t) => a + (t.pnl ?? 0), 0);
  const openRisk = trades.filter((t) => t.result === "OPEN").reduce((a, t) => a + t.riskAmount, 0);
  const eq = equityPoints(at, account.startingBalance, user.timezone);
  const dd = calculateDrawdown(eq.map((p) => p.equity));
  const chronological = [...closed].sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime());
  const insights = plan.limits.advancedAnalytics ? generateInsights(at, account.startingBalance, new Date(), user.timezone).slice(0, 3) : [];

  return (
    <>
      <PageHeader
        title={`${account.name}`}
        subtitle="How much am I risking today?"
        action={<LinkButton href="/calculator"><Calculator size={16} /> Calculate a trade</LinkButton>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Account balance" value={money(balance, cur)} sub={`Started at ${money(account.startingBalance, cur)}`} />
        <Stat label="Today's P&L" value={money(pnlToday, cur, { sign: true })} tone={pnlToday > 0 ? "up" : pnlToday < 0 ? "down" : undefined} />
        <Stat label="Risk today" value={pct(g.riskTodayPercent)} sub="of your account" tone={g.riskTodayPercent > account.riskSettings.maxDailyLossPercent ? "warn" : undefined} hint="The total amount you put at risk across today's trades, as a share of your account." />
        <Stat label="Trades today" value={`${todays.length}/${account.riskSettings.maxTradesPerDay}`} sub={`${g.tradesRemaining} left`} tone={g.tradeLimitReached ? "down" : undefined} />
        <Stat label="Max drawdown" value={pct(dd.maxDrawdownPercent)} sub={`Now ${pct(dd.currentDrawdownPercent)}`} tone={dd.maxDrawdownPercent > 10 ? "warn" : undefined} hint="The biggest fall from a balance peak to a later low. It shows how deep your worst losing stretch has been." />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
        <GuardrailCard g={g} currency={cur} maxTrades={account.riskSettings.maxTradesPerDay} tradesToday={todays.length} openRisk={openRisk} balance={balance} />
        <Card>
          <CardHeader title="Risk exposure" hint="How much you could lose right now, based on your own limits." />
          <div className="divide-y divide-line text-sm">
            <ExposureRow label="Daily risk" value={`${money(g.dailyLossUsed, cur, { decimals: 2 })} of ${money(g.dailyLimitAmount, cur, { decimals: 2 })}`} />
            <ExposureRow label="Weekly risk" value={`${money(g.weeklyLossUsed, cur, { decimals: 2 })} of ${money(g.weeklyLimitAmount, cur, { decimals: 2 })}`} />
            <ExposureRow label="Open risk" value={`${money(openRisk, cur, { decimals: 2 })} (${balance > 0 ? ((openRisk / balance) * 100).toFixed(1) : 0}%)`} />
            <ExposureRow label="Your max risk per trade" value={`${account.riskSettings.maxRiskPerTrade}%`} />
          </div>
          {insights.length > 0 && (
            <div className="space-y-2 border-t border-line p-4">
              {insights.map((i, k) => <p key={k} className="text-sm text-muted"><Badge tone={i.tone === "warn" ? "warn" : "neutral"} className="mr-2">Insight</Badge>{i.text}</p>)}
            </div>
          )}
        </Card>
      </div>

      {closed.length === 0 ? (
        <div className="mt-5"><Empty title="No closed trades yet" body="Calculate your position size, take the trade, then record it. Your charts and insights appear here." action={<LinkButton href="/journal/new" variant="secondary">Record a trade</LinkButton>} /></div>
      ) : (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Card><CardHeader title="Equity curve" /><div className="p-3"><EquityChart data={eq} /></div></Card>
          <Card>
            <CardHeader title="Drawdown curve" hint="How far below your best balance you were after each trade." />
            <div className="p-3">{plan.limits.advancedAnalytics ? <DrawdownChart data={eq.map((p, i) => ({ label: p.label, dd: Number(dd.series[i].toFixed(2)) }))} /> : <div className="p-3"><UpgradeNote feature="Drawdown analytics are included in Pro." /></div>}</div>
          </Card>
          <Card><CardHeader title="P&L by day" /><div className="p-3"><PnlByDayChart data={pnlByDay(at, user.timezone).slice(-30)} /></div></Card>
          <Card><CardHeader title="Risk per trade" hint="Each bar is the % of your account you risked. Green = winner, red = loser." /><div className="p-3"><RiskPerTradeChart data={chronological.slice(-40).map((t, i) => ({ n: i + 1, risk: Number(t.riskPercent.toFixed(2)), win: t.result === "WIN" }))} limit={account.riskSettings.maxRiskPerTrade} /></div></Card>
          <Card className="lg:col-span-2"><CardHeader title="Win / loss distribution" hint="How many trades ended at each R multiple. 1R = the amount you risked." /><div className="p-3"><DistributionChart data={rDistribution(at)} /></div></Card>
        </div>
      )}

      <Card className="mt-5">
        <CardHeader title="Recent trades" action={<Link href="/journal" className="text-xs text-accent hover:underline">View journal</Link>} />
        {trades.length === 0 ? <p className="p-4 text-sm text-muted">Nothing recorded yet.</p> : (
          <ul className="divide-y divide-line">
            {trades.slice(0, 5).map((t) => (
              <li key={t.id}>
                <Link href={`/journal/${t.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-surface-2">
                  <span><b>{t.instrument}</b> <span className="text-muted">{t.direction === "LONG" ? "Long" : "Short"} · {fmtDate(t.openedAt, user.timezone)}</span></span>
                  <span className="num flex items-center gap-3"><span className="text-muted">{rFmt(t.rMultiple)}</span><span className={t.pnl === null ? "text-muted" : t.pnl >= 0 ? "text-up" : "text-down"}>{t.pnl === null ? "Open" : money(t.pnl, cur, { sign: true, decimals: 2 })}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="mt-6"><Disclaimer /></div>
    </>
  );
}

function ExposureRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between px-4 py-3"><span className="text-muted">{label}</span><span className="num font-medium">{value}</span></div>;
}
