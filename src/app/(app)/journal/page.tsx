import type { Metadata } from "next";
import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { Badge, Empty, LinkButton, PageHeader, Card } from "@/components/ui";
import { getContext } from "@/lib/session";
import { loadTrades } from "@/lib/data";
import { prisma } from "@/lib/db";
import { fmtDate, money, price, rFmt } from "@/lib/utils";

export const metadata: Metadata = { title: "Journal" };

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ instrument?: string; result?: string; q?: string }> }) {
  const sp = await searchParams;
  const { user, account, plan } = await getContext();
  const all = await loadTrades(user.id, account.id);
  const q = sp.q?.toLowerCase().trim();
  const trades = all.filter((t) => (!sp.instrument || t.instrument === sp.instrument) && (!sp.result || t.result === sp.result) && (!q || [t.setup, t.notes, t.reasonEntry, ...t.tags.map((x) => x.name)].some((s) => s?.toLowerCase().includes(q))));
  const instruments = [...new Set(all.map((t) => t.instrument))].sort();
  const totalTrades = await prisma.trade.count({ where: { userId: user.id } });
  const limit = plan.limits.maxTrades;

  return (
    <>
      <PageHeader title="Trade journal" subtitle={`${all.length} trade${all.length === 1 ? "" : "s"} in ${account.name}`}
        action={<div className="flex gap-2">
          {plan.limits.exportData && <a href="/api/export" className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-surface-2 px-4 text-sm font-medium"><Download size={15} /> Export CSV</a>}
          <Link href="/journal/import" className="inline-flex h-10 items-center rounded-lg border border-line bg-surface-2 px-4 text-sm font-medium">Import CSV</Link>
          <LinkButton href="/journal/new"><Plus size={16} /> Record trade</LinkButton>
        </div>} />
      {limit !== Infinity && <p className="mb-4 text-sm text-muted">Free plan: {totalTrades} / {limit} trades used. <Link href="/billing" className="text-accent hover:underline">Upgrade for unlimited</Link>.</p>}

      <form className="mb-4 flex flex-wrap gap-2 text-sm">
        <input name="q" defaultValue={sp.q} placeholder="Search notes, setups, tags" className="h-10 min-w-48 flex-1 rounded-lg border border-line bg-bg px-3" />
        <select name="instrument" defaultValue={sp.instrument ?? ""} className="h-10 rounded-lg border border-line bg-bg px-3"><option value="">All instruments</option>{instruments.map((i) => <option key={i}>{i}</option>)}</select>
        <select name="result" defaultValue={sp.result ?? ""} className="h-10 rounded-lg border border-line bg-bg px-3"><option value="">All results</option>{["WIN", "LOSS", "BREAKEVEN", "OPEN"].map((r) => <option key={r}>{r}</option>)}</select>
        <button className="h-10 rounded-lg border border-line bg-surface-2 px-4">Filter</button>
      </form>

      {trades.length === 0 ? (
        <Empty title={all.length ? "No trades match your filters" : "Your journal is empty"} body="Every recorded trade teaches you something about your risk habits." action={<LinkButton href="/journal/new">Record your first trade</LinkButton>} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted"><tr>{["Date", "Instrument", "Side", "Entry", "Risk", "Result", "P&L", "R"].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {trades.map((t) => (
                <tr key={t.id} className="hover:bg-surface-2/60">
                  <td className="px-4 py-3 text-muted"><Link href={`/journal/${t.id}`} className="hover:text-fg">{fmtDate(t.openedAt, user.timezone)}</Link></td>
                  <td className="px-4 py-3 font-medium"><Link href={`/journal/${t.id}`}>{t.instrument}</Link>{t._count.screenshots > 0 && <span className="ml-2 text-xs text-muted">📷{t._count.screenshots}</span>}</td>
                  <td className="px-4 py-3"><Badge tone={t.direction === "LONG" ? "up" : "down"}>{t.direction === "LONG" ? "Long" : "Short"}</Badge></td>
                  <td className="num px-4 py-3">{price(t.entryPrice)}</td>
                  <td className="num px-4 py-3">{t.riskPercent.toFixed(2)}%</td>
                  <td className="px-4 py-3"><Badge tone={t.result === "WIN" ? "up" : t.result === "LOSS" ? "down" : "neutral"}>{t.result}</Badge></td>
                  <td className={`num px-4 py-3 ${t.pnl === null ? "text-muted" : t.pnl >= 0 ? "text-up" : "text-down"}`}>{t.pnl === null ? "—" : money(t.pnl, account.currency, { sign: true, decimals: 2 })}</td>
                  <td className="num px-4 py-3 text-muted">{rFmt(t.rMultiple)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
