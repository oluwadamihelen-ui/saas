import type { Metadata } from "next";
import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { Badge, Button, Card, CardHeader, Empty, LinkButton, PageHeader, Stat } from "@/components/ui";
import { PnlByDayChart } from "@/components/charts";
import { PayoutMethodForm } from "@/components/market/creator-forms";
import { Stars } from "@/components/market/parts";
import { getUser } from "@/lib/session";
import { creatorChecklist, creatorOverview } from "@/lib/market/creator";
import { getMarketSettings } from "@/lib/market/settings";
import { usd } from "@/lib/market/fees";
import { priceLabel, STATUS_LABEL, STATUS_TONE } from "@/lib/market/format";
import { markTvGrantedAction, requestPayoutAction } from "@/actions/market";
import { fmtDate, pct } from "@/lib/utils";

export const metadata: Metadata = { title: "Creator dashboard" };

export default async function CreatorPage({ searchParams }: { searchParams: Promise<{ g?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const user = await getUser();
  const [o, checklist, settings] = await Promise.all([creatorOverview(user.id), creatorChecklist(user.id), getMarketSettings()]);
  const g = (["day", "week", "month"] as const).find((x) => x === sp.g) ?? "day";

  if (!o) {
    return (
      <>
        <PageHeader title="Become a creator" subtitle="Turn your indicator into a product — private source code stays private." />
        <Card className="p-6">
          <ol className="grid gap-3 sm:grid-cols-2">{checklist.map((s) => <li key={s.n} className="flex items-center gap-3 text-sm"><span className="grid h-6 w-6 place-items-center rounded-full bg-surface-2 text-xs text-muted">{s.n}</span>{s.label}</li>)}</ol>
          <LinkButton href="/creator/profile" size="lg" className="mt-6">Create creator profile</LinkButton>
          <p className="mt-4 text-xs text-muted">RiskPilot is a technology and marketplace service. Creators are responsible for their product descriptions. Guaranteed-profit claims are not allowed. See the <Link href="/legal/seller-terms" className="underline">Seller Terms</Link>.</p>
        </Card>
      </>
    );
  }

  const b = o.balances;
  const series = o.revenue[g].map((p) => ({ day: p.label, pnl: p.cents / 100 }));
  return (
    <>
      <PageHeader title="Creator dashboard" subtitle={`${o.creator.displayName}${o.creator.verified ? " · verified" : ""}`} action={<div className="flex gap-2"><LinkButton href="/creator/profile" variant="secondary" size="sm">Profile</LinkButton><LinkButton href="/lab" size="sm">Indicator Lab</LinkButton></div>} />
      {sp.ok && <p className="mb-4 rounded-xl bg-up-soft px-4 py-3 text-sm text-up">{sp.ok}</p>}
      {sp.error && <p role="alert" className="mb-4 rounded-xl bg-down-soft px-4 py-3 text-sm text-down">{sp.error}</p>}
      {o.creator.status === "SUSPENDED" && <p className="mb-4 rounded-xl bg-down-soft px-4 py-3 text-sm text-down">Your creator account is suspended. Your products are hidden.</p>}

      <Card className="mb-5 p-4"><p className="mb-3 text-sm font-semibold">Your path</p><ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{checklist.map((s) => <li key={s.n}><Link href={s.href} className="flex items-center gap-2 text-sm hover:text-fg">{s.done ? <Check size={16} className="text-up" /> : <Circle size={16} className="text-muted" />}<span className={s.done ? "text-muted line-through" : ""}>{s.n}. {s.label}</span></Link></li>)}</ol></Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total earnings" value={usd(b.totalEarningsCents)} sub="after refunds & commission" />
        <Stat label="Available" value={usd(b.availableCents)} sub="ready for payout" tone={b.availableCents > 0 ? "up" : undefined} />
        <Stat label="Pending" value={usd(b.pendingCents)} sub={`held ${settings.holdbackDays} days`} hint="New sales are held briefly so refunds can be handled before they become available." />
        <Stat label="Total paid" value={usd(b.totalPaidCents)} sub={b.reservedCents ? `${usd(b.reservedCents)} in progress` : undefined} />
        <Stat label="Sales" value={o.totals.sales} sub={`${o.totals.subscribers} active subscribers`} />
        <Stat label="Access granted" value={o.totals.access} sub="downloads / licenses" />
        <Stat label="Views → access" value={pct(o.totals.conversion, 1)} sub={`${o.totals.views.toLocaleString()} product views`} hint="Share of product-page views that ended with someone getting access (free or paid)." />
        <Stat label="Refund rate" value={pct(o.totals.refundRate, 1)} sub={`${o.totals.refunds} refunds`} tone={o.totals.refundRate > 10 ? "warn" : undefined} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader title="Revenue (your earnings, net of refunds)" action={<div className="flex gap-1 text-xs">{(["day", "week", "month"] as const).map((x) => <Link key={x} href={`/creator?g=${x}`} className={`rounded-md px-2 py-1 ${g === x ? "bg-accent-soft text-fg" : "text-muted hover:text-fg"}`}>{x === "day" ? "Daily" : x === "week" ? "Weekly" : "Monthly"}</Link>)}</div>} />
          <div className="p-3"><PnlByDayChart data={series} /></div>
        </Card>
        <Card>
          <CardHeader title="Top products" />
          {o.top.length === 0 ? <p className="p-4 text-sm text-muted">No sales yet.</p> : <ul className="divide-y divide-line">{o.top.map((t) => <li key={t.id} className="flex items-center justify-between px-4 py-3 text-sm"><span>{t.title}</span><b className="num">{usd(t.revenueCents)}</b></li>)}</ul>}
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader title="My indicators" action={<Link href="/lab" className="text-xs text-accent hover:underline">Add in Lab</Link>} />
        {o.rows.length === 0 ? <div className="p-4"><Empty title="No products yet" body="Open an indicator in the Lab and choose “Sell this indicator”." action={<LinkButton href="/lab">Go to the Lab</LinkButton>} /></div> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead className="text-left text-xs uppercase tracking-wider text-muted"><tr>{["Product", "Price", "Subscribers", "Sales", "Revenue", "Rating", "Views", "Conv.", "Refunds", "Status", ""].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">{o.rows.map((r) => (
              <tr key={r.id}><td className="px-3 py-3 font-medium">{r.title}<span className="block text-xs font-normal text-muted">v{r.indicator.latestVersion} · {r.indicator.visibility.toLowerCase()}</span></td>
                <td className="px-3 py-3">{priceLabel(r.pricingModel, r.priceUsdCents)}</td><td className="num px-3 py-3">{r.subscribers}</td><td className="num px-3 py-3">{r.sales}</td><td className="num px-3 py-3">{usd(r.revenueCents)}</td>
                <td className="px-3 py-3"><Stars avg={r.rating.avg} count={r.rating.count} size={12} /></td><td className="num px-3 py-3">{r.views}</td><td className="num px-3 py-3">{pct(r.conversion, 1)}</td><td className="num px-3 py-3">{pct(r.refundRate, 0)}</td>
                <td className="px-3 py-3"><Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>{r.rejectionReason && r.status !== "APPROVED" && <span className="mt-1 block max-w-48 text-xs text-warn">{r.rejectionReason}</span>}</td>
                <td className="px-3 py-3 text-right"><Link href={`/creator/listings/${r.id}`} className="text-xs text-accent hover:underline">Manage</Link></td></tr>
            ))}</tbody></table></div>
        )}
      </Card>

      {o.grants.length > 0 && (
        <Card className="mt-5"><CardHeader title="TradingView access to grant" hint="Add each username to your invite-only script in TradingView, then mark it done." />
          <ul className="divide-y divide-line">{o.grants.map((gr) => <li key={gr.id} className="flex items-center justify-between px-4 py-3 text-sm"><span><b className="num">{gr.tradingViewUsername}</b> <span className="text-muted">· {gr.listing.title}</span></span><form action={markTvGrantedAction}><input type="hidden" name="licenseId" value={gr.id} /><Button size="sm" variant="secondary">Mark granted</Button></form></li>)}</ul></Card>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Payouts" action={<Badge tone={o.payoutStatus === "READY" ? "up" : o.payoutStatus === "PENDING_VERIFICATION" ? "warn" : "neutral"}>{o.payoutStatus === "READY" ? "Ready" : o.payoutStatus === "PENDING_VERIFICATION" ? "Awaiting verification" : "Not set up"}</Badge>} />
          <div className="space-y-4 p-4">
            <p className="text-sm text-muted">Available <b className="num text-fg">{usd(b.availableCents)}</b> · minimum payout {usd(settings.minPayoutUsdCents)}.</p>
            <PayoutMethodForm hint={o.creator.payoutMethodHint} />
            <form action={requestPayoutAction}><Button disabled={o.payoutStatus !== "READY" || b.availableCents < settings.minPayoutUsdCents}>Request payout of {usd(b.availableCents)}</Button></form>
            {o.payouts.length > 0 && <ul className="divide-y divide-line text-sm">{o.payouts.map((p) => <li key={p.id} className="flex justify-between py-2"><span className="text-muted">{fmtDate(p.requestedAt, user.timezone)}{p.reference ? ` · ${p.reference}` : ""}</span><span className="flex items-center gap-2"><b className="num">{usd(p.amountUsdCents)}</b><Badge tone={p.status === "PAID" ? "up" : p.status === "FAILED" || p.status === "CANCELED" ? "down" : "warn"}>{p.status.toLowerCase()}</Badge></span></li>)}</ul>}
          </div>
        </Card>
        <Card>
          <CardHeader title="Recent orders" />
          {o.recent.length === 0 ? <p className="p-4 text-sm text-muted">No orders yet.</p> : <ul className="divide-y divide-line text-sm">{o.recent.map((r) => <li key={r.id} className="flex items-center justify-between px-4 py-3"><span>{r.listing.title}<span className="block text-xs text-muted">{fmtDate(r.createdAt, user.timezone)}</span></span><span className="flex items-center gap-2"><span className="num">{usd(r.creatorEarningUsdCents)}</span><Badge tone={r.status === "PAID" ? "up" : r.status === "REFUNDED" ? "down" : "neutral"}>{r.status.toLowerCase()}</Badge></span></li>)}</ul>}
        </Card>
      </div>
    </>
  );
}
