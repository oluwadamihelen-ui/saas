import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardHeader, LinkButton, PageHeader } from "@/components/ui";
import { StrategyBuilder } from "@/components/lab/forms";
import { getUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getOwnedStrategy } from "@/lib/lab/service";
import { parseStrategyDef } from "@/lib/lab/schemas";
import { fmtDate, pct, rFmt } from "@/lib/utils";

export const metadata: Metadata = { title: "Strategy" };

export default async function StrategyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  const s = await getOwnedStrategy(user.id, id);
  if (!s) notFound();
  const def = parseStrategyDef(s.definition);
  const runs = await prisma.backtestRun.findMany({ where: { userId: user.id, strategyId: id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, label: true, kind: true, sampleType: true, synthetic: true, tradeCount: true, summary: true, createdAt: true } });
  return (
    <>
      <PageHeader title={s.name} subtitle={`${s.symbol}${s.indicator ? ` · based on ${s.indicator.name}` : ""}`}
        action={<div className="flex flex-wrap gap-2"><LinkButton href={`/lab/strategies/${id}/test`} size="sm">Backtest</LinkButton><LinkButton href={`/lab/strategies/${id}/optimize`} variant="secondary" size="sm">Parameter test</LinkButton><LinkButton href={`/lab/strategies/${id}/walkforward`} variant="secondary" size="sm">Walk-forward</LinkButton></div>} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>{def.ok ? <StrategyBuilder id={id} initial={def.def} indicatorId={s.indicatorId ?? undefined} indicatorName={s.indicator?.name} defaultName={s.name} defaultSymbol={s.symbol} /> : <p className="text-down">{def.error}</p>}</div>
        <Card className="h-fit">
          <CardHeader title="Tests of this strategy" />
          {runs.length === 0 ? <p className="p-4 text-sm text-muted">None yet. Run a backtest.</p> : (
            <ul className="divide-y divide-line">{runs.map((r) => { const sm = r.summary as { avgR?: number | null; maxDrawdownPercent?: number }; return (
              <li key={r.id}><Link href={`/lab/runs/${r.id}`} className="block px-4 py-3 text-sm hover:bg-surface-2"><div className="flex items-center justify-between"><b>{r.label || r.kind.toLowerCase().replace("_", " ")}</b><span className="flex gap-1">{r.synthetic && <Badge tone="warn">synthetic</Badge>}{r.sampleType !== "FULL" && <Badge tone="accent">{r.sampleType === "IN_SAMPLE" ? "in-sample" : "out-of-sample"}</Badge>}</span></div>
                <p className="mt-0.5 text-xs text-muted">{fmtDate(r.createdAt, user.timezone)}{r.kind !== "OPTIMIZATION" ? ` · ${r.tradeCount} trades · avg ${rFmt(sm.avgR ?? null)} · DD ${pct(sm.maxDrawdownPercent ?? 0)}` : ""}</p></Link></li>
            ); })}</ul>
          )}
        </Card>
      </div>
    </>
  );
}
