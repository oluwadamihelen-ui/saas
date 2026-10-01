import type { Metadata } from "next";
import Link from "next/link";
import { Database, FileCode2, FlaskConical, Plus, Upload } from "lucide-react";
import { Badge, Card, CardHeader, Disclaimer, Empty, LinkButton, PageHeader } from "@/components/ui";
import { getUser } from "@/lib/session";
import { loadPlan } from "@/lib/plan";
import { prisma } from "@/lib/db";
import { fmtDate, pct, rFmt } from "@/lib/utils";

export const metadata: Metadata = { title: "Indicator Lab" };

export default async function LabHome() {
  const user = await getUser();
  const plan = await loadPlan(user.id);
  const [indicators, strategies, datasets, runs] = await Promise.all([
    prisma.indicator.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, select: { id: true, name: true, visibility: true, latestVersion: true, markets: true, listing: { select: { status: true } } } }),
    prisma.strategy.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, select: { id: true, name: true, symbol: true, indicator: { select: { name: true } } } }),
    prisma.dataset.count({ where: { userId: user.id } }),
    prisma.backtestRun.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, label: true, kind: true, sampleType: true, synthetic: true, tradeCount: true, summary: true, createdAt: true, strategy: { select: { name: true } } } }),
  ]);
  const lim = plan.limits.lab;
  return (
    <>
      <PageHeader title="Indicator Lab" subtitle="Create or import indicators, turn them into explicit strategies, and test them on historical data." action={<LinkButton href="/lab/indicators/new"><Plus size={16} /> Import indicator</LinkButton>} />
      <Disclaimer />
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title={<><FileCode2 size={15} className="text-accent" /> Indicators ({indicators.length}/{lim.indicators > 1000 ? "∞" : lim.indicators})</>} hint="Your Pine Script indicators. Source code is private to you." action={<Link href="/lab/indicators/new" className="text-xs text-accent hover:underline">New</Link>} />
          {indicators.length === 0 ? <div className="p-4"><Empty title="No indicators yet" body="Paste or upload a Pine Script to store it, document its inputs and test it." action={<LinkButton href="/lab/indicators/new">Import your first indicator</LinkButton>} /></div> : (
            <ul className="divide-y divide-line">{indicators.map((i) => (
              <li key={i.id}><Link href={`/lab/indicators/${i.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-surface-2">
                <span><b>{i.name}</b> <span className="text-muted">v{i.latestVersion} · {i.markets.join(", ") || "no market set"}</span></span>
                <span className="flex gap-1.5"><Badge tone={i.visibility === "PRIVATE" ? "neutral" : "accent"}>{i.visibility.toLowerCase()}</Badge>{i.listing && <Badge tone={i.listing.status === "APPROVED" ? "up" : "warn"}>{i.listing.status.replace("_", " ").toLowerCase()}</Badge>}</span>
              </Link></li>
            ))}</ul>
          )}
        </Card>
        <Card>
          <CardHeader title={<><FlaskConical size={15} className="text-accent" /> Strategies ({strategies.length})</>} hint="A strategy is a set of explicit rules: when to enter, exit, where the stop and target go. An indicator alone isn't one." action={<Link href="/lab/strategies/new" className="text-xs text-accent hover:underline">New</Link>} />
          {strategies.length === 0 ? <div className="p-4"><Empty title="No strategies yet" body="Define entry, exit, stop and target rules — on top of an indicator or from scratch." action={<LinkButton href="/lab/strategies/new" variant="secondary">Build a strategy</LinkButton>} /></div> : (
            <ul className="divide-y divide-line">{strategies.map((s) => <li key={s.id}><Link href={`/lab/strategies/${s.id}`} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-surface-2"><b>{s.name}</b><span className="text-muted">{s.symbol}{s.indicator ? ` · ${s.indicator.name}` : ""}</span></Link></li>)}</ul>
          )}
        </Card>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Link href="/lab/data" className="rounded-xl border border-line bg-surface p-4 hover:border-muted/60"><Database size={18} className="text-accent" /><p className="mt-2 font-medium">Candle data</p><p className="text-xs text-muted">{datasets} dataset{datasets === 1 ? "" : "s"} · upload CSV</p></Link>
        <Link href="/lab/import" className="rounded-xl border border-line bg-surface p-4 hover:border-muted/60"><Upload size={18} className="text-accent" /><p className="mt-2 font-medium">Import TradingView results</p><p className="text-xs text-muted">Analyse a Strategy Tester export</p></Link>
        <Link href="/lab/compare" className="rounded-xl border border-line bg-surface p-4 hover:border-muted/60"><FlaskConical size={18} className="text-accent" /><p className="mt-2 font-medium">Compare tests</p><p className="text-xs text-muted">Side by side, no ranking</p></Link>
      </div>
      <Card className="mt-5">
        <CardHeader title="Recent tests" />
        {runs.length === 0 ? <p className="p-4 text-sm text-muted">No tests yet.</p> : (
          <ul className="divide-y divide-line">{runs.map((r) => {
            const s = r.summary as { avgR?: number | null; maxDrawdownPercent?: number };
            return (
              <li key={r.id}><Link href={r.kind === "WALK_FORWARD" ? `/lab/runs/${r.id}` : `/lab/runs/${r.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-surface-2">
                <span><b>{r.strategy?.name ?? r.label ?? "Test"}</b> <span className="text-muted">· {r.label || r.kind.toLowerCase()} · {fmtDate(r.createdAt, user.timezone)}</span></span>
                <span className="flex items-center gap-2 text-xs">{r.synthetic && <Badge tone="warn">synthetic</Badge>}<Badge>{r.sampleType === "FULL" ? r.kind.toLowerCase().replace("_", " ") : r.sampleType.replace("_", "-").toLowerCase()}</Badge>{r.kind !== "OPTIMIZATION" && <span className="num text-muted">{r.tradeCount} trades · avg {rFmt(s.avgR ?? null)} · DD {pct(s.maxDrawdownPercent ?? 0)}</span>}</span>
              </Link></li>
            );
          })}</ul>
        )}
      </Card>
    </>
  );
}
