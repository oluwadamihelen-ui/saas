import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, Card, CardHeader, PageHeader } from "@/components/ui";
import { getContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { deleteScreenshotAction, deleteTradeAction } from "@/actions/trade";
import { fmtDate, money, price, rFmt } from "@/lib/utils";

export const metadata: Metadata = { title: "Trade" };

export default async function TradePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { id } = await params;
  const { notice } = await searchParams;
  const { user, accounts } = await getContext();
  const t = await prisma.trade.findFirst({ where: { id, userId: user.id }, include: { tags: true, screenshots: true } });
  if (!t) notFound();
  const cur = accounts.find((a) => a.id === t.accountId)?.currency ?? "USD";
  const rows: [string, React.ReactNode][] = [
    ["Date", fmtDate(t.openedAt, user.timezone, true)],
    ["Direction", t.direction === "LONG" ? "Long" : "Short"],
    ["Entry", <span key="e" className="num">{price(t.entryPrice)}</span>],
    ["Stop loss", <span key="s" className="num">{price(t.stopLoss)}</span>],
    ["Take profit", t.takeProfit ? <span key="t" className="num">{price(t.takeProfit)}</span> : "—"],
    ["Exit", t.exitPrice ? <span key="x" className="num">{price(t.exitPrice)}</span> : "—"],
    ["Position size", <span key="l" className="num">{t.lots} lots</span>],
    ["Risk", <span key="r" className="num">{money(t.riskAmount, cur, { decimals: 2 })} ({t.riskPercent.toFixed(2)}%)</span>],
    ["Setup", t.setup ?? "—"], ["Session", t.session ?? "—"],
    ["Emotion before → after", `${t.emotionBefore ?? "—"} → ${t.emotionAfter ?? "—"}`],
    ["Discipline score", t.checklistScore !== null ? `${t.checklistScore}%` : "—"],
  ];
  return (
    <>
      <PageHeader title={`${t.instrument} ${t.direction === "LONG" ? "Long" : "Short"}`} subtitle={fmtDate(t.openedAt, user.timezone)}
        action={<div className="flex gap-2"><Link href={`/journal/${t.id}/edit`} className="inline-flex h-10 items-center rounded-lg border border-line bg-surface-2 px-4 text-sm font-medium">Edit</Link>
          <form action={deleteTradeAction}><input type="hidden" name="id" value={t.id} /><Button variant="danger">Delete</Button></form></div>} />
      {notice && <p className="mb-4 rounded-lg bg-warn-soft px-4 py-3 text-sm text-warn">{notice}</p>}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Card className="p-4"><div className="text-xs uppercase tracking-wider text-muted">Result</div><div className="mt-1"><Badge tone={t.result === "WIN" ? "up" : t.result === "LOSS" ? "down" : "neutral"}>{t.result}</Badge></div></Card>
        <Card className="p-4"><div className="text-xs uppercase tracking-wider text-muted">P&L</div><div className={`num mt-1 text-xl font-semibold ${t.pnl === null ? "" : t.pnl >= 0 ? "text-up" : "text-down"}`}>{t.pnl === null ? "Open" : money(t.pnl, cur, { sign: true, decimals: 2 })}</div></Card>
        <Card className="p-4"><div className="text-xs uppercase tracking-wider text-muted">R multiple</div><div className="num mt-1 text-xl font-semibold">{rFmt(t.rMultiple)}</div></Card>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card><CardHeader title="Details" /><dl className="divide-y divide-line text-sm">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 px-4 py-2.5"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>)}</dl></Card>
        <Card>
          <CardHeader title="Journal" />
          <div className="space-y-4 p-4 text-sm">
            <Block label="Reason for entry" text={t.reasonEntry} /><Block label="Reason for exit" text={t.reasonExit} /><Block label="Notes" text={t.notes} />
            {t.tags.length > 0 && <div className="flex flex-wrap gap-1.5">{t.tags.map((x) => <Badge key={x.id} tone="accent">{x.name}</Badge>)}</div>}
          </div>
        </Card>
      </div>
      {t.screenshots.length > 0 && (
        <Card className="mt-5">
          <CardHeader title="Screenshots" />
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {t.screenshots.map((s) => (
              <div key={s.id} className="overflow-hidden rounded-lg border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <a href={`/api/screenshots/${s.id}`} target="_blank" rel="noreferrer"><img src={`/api/screenshots/${s.id}`} alt="Trade screenshot" className="w-full" loading="lazy" /></a>
                <form action={deleteScreenshotAction} className="p-2 text-right"><input type="hidden" name="id" value={s.id} /><button className="text-xs text-muted hover:text-down">Remove</button></form>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

function Block({ label, text }: { label: string; text: string | null }) {
  return <div><div className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</div><p className="mt-1 whitespace-pre-wrap">{text || "—"}</p></div>;
}
