import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, FileText, Lock, Unlock } from "lucide-react";
import { Badge, Card, CardHeader, LinkButton } from "@/components/ui";
import { Stars } from "@/components/market/parts";
import { BuyBox, ReportForm, ReviewForm } from "@/components/market/client";
import { EvidenceCard } from "@/components/market/evidence";
import { getViewer } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getListingPage, recordView } from "@/lib/market/listings";
import { getMarketSettings } from "@/lib/market/settings";
import { isLicenseActive, canReview } from "@/lib/market/licensing";
import { ngnShort, priceLabel, STATUS_LABEL } from "@/lib/market/format";
import { fmtDate } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const l = await prisma.listing.findUnique({ where: { slug }, select: { title: true, tagline: true, status: true, indicator: { select: { visibility: true } } } });
  if (!l || l.status !== "APPROVED") return { title: "Marketplace" };
  return { title: l.title, description: l.tagline || undefined, robots: l.indicator.visibility === "UNLISTED" ? { index: false } : undefined };
}

const POLICY: Record<string, string> = { ALL_UPDATES: "All future updates included", SAME_MAJOR: "Updates within the version you buy (e.g. 1.x)", NO_UPDATES: "Version at purchase only" };

export default async function ListingPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const viewer = await getViewer();
  const l = await getListingPage(slug, viewer);
  if (!l) notFound();
  const settings = await getMarketSettings();
  const live = l.status === "APPROVED";
  if (live && !l.isOwner) await recordView(l.id).catch(() => {});

  const license = viewer ? await prisma.license.findUnique({ where: { userId_listingId: { userId: viewer.id, listingId: l.id } } }) : null;
  const nowMs = new Date().getTime();
  const active = license ? isLicenseActive(license, new Date(nowMs)) : false;
  const canRenew = !!license && (l.pricingModel === "MONTHLY" || l.pricingModel === "YEARLY") && (!active || (license.currentPeriodEnd && license.currentPeriodEnd.getTime() - nowMs < 7 * 86_400_000));
  const myReview = viewer ? await prisma.review.findUnique({ where: { listingId_userId: { listingId: l.id, userId: viewer.id } }, select: { id: true } }) : null;
  const reviewGate = viewer ? canReview({ userId: viewer.id, creatorUserId: l.creator.userId, license }) : { ok: false };

  const buyLabel = l.pricingModel === "FREE" ? "Get it free" : canRenew ? "Renew access" : `Buy · ${priceLabel(l.pricingModel, l.priceUsdCents)}`;
  const protectedProduct = !l.sourceIncluded;
  return (
    <div className="space-y-6">
      {!live && <p className="rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 text-sm text-warn">Preview — this listing is <b>{STATUS_LABEL[l.status] ?? l.status}</b> and not visible to the public.{l.rejectionReason ? ` Reason: ${l.rejectionReason}` : ""}</p>}
      {sp.ok && <p className="rounded-xl bg-up-soft px-4 py-3 text-sm text-up">{sp.ok}</p>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2"><Badge tone="accent">{l.indicator.kind === "STRATEGY" ? "Strategy" : "Indicator"}</Badge>{l.categories.map((c) => <Badge key={c}>{c.replace("-", " ")}</Badge>)}</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{l.title}</h1>
            {l.tagline && <p className="mt-1 text-muted">{l.tagline}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <Link href={`/market/creators/${l.creator.slug}`} className="inline-flex items-center gap-1 hover:text-fg">by {l.creator.displayName}{l.creator.verified && <BadgeCheck size={15} className="text-accent" aria-label="Verified creator" />}</Link>
              <Stars avg={l.rating.avg} count={l.rating.count} />
              <span>v{l.indicator.latestVersion}</span>
            </div>
          </div>

          {l.media.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">{l.media.map((m) => (
              // eslint-disable-next-line @next/next/no-img-element
              <figure key={m.id} className="overflow-hidden rounded-xl border border-line"><img src={`/api/market/media/${m.id}`} alt={m.caption || `${l.title} screenshot`} className="w-full" loading="lazy" />{m.caption && <figcaption className="px-3 py-2 text-xs text-muted">{m.caption}</figcaption>}</figure>
            ))}</div>
          )}
          {l.demoVideoUrl && <a href={l.demoVideoUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm hover:border-muted/60">▶ Watch the demo video</a>}

          <Card><CardHeader title="About" /><div className="space-y-4 p-4 text-sm"><p className="whitespace-pre-wrap">{l.description}</p>{l.features.length > 0 && <ul className="list-disc space-y-1 pl-5 text-muted">{l.features.map((f) => <li key={f}>{f}</li>)}</ul>}</div></Card>

          <section className="space-y-3" aria-labelledby="demo">
            <div><h2 id="demo" className="text-lg font-semibold">Historical simulations</h2>
              <p className="text-sm text-muted">The creator&apos;s own backtests, shown with every assumption. They are <b>historical simulations</b> — not guarantees and not a forecast.</p></div>
            {l.evidence.length === 0 ? <p className="rounded-xl border border-dashed border-line px-4 py-6 text-sm text-muted">The creator has not published any backtests for this product.</p> : l.evidence.map((e) => <EvidenceCard key={e.id} e={e} />)}
            {(l.methodology || l.dataSourceNote) && (
              <Card><CardHeader title="Backtest methodology & data" /><div className="space-y-3 p-4 text-sm">{l.methodology && <div><p className="text-xs font-semibold uppercase tracking-wider text-muted">Methodology</p><p className="mt-1 whitespace-pre-wrap">{l.methodology}</p></div>}{l.dataSourceNote && <div><p className="text-xs font-semibold uppercase tracking-wider text-muted">Data source</p><p className="mt-1 whitespace-pre-wrap">{l.dataSourceNote}</p></div>}</div></Card>
            )}
          </section>

          {l.documentation && <Card><CardHeader title={<span className="flex items-center gap-2"><FileText size={15} /> Documentation</span>} /><div className="whitespace-pre-wrap p-4 text-sm text-muted">{l.documentation}</div></Card>}

          <Card>
            <CardHeader title="Version & update history" />
            <ul className="divide-y divide-line">{l.indicator.versions.map((v) => <li key={v.id} className="px-4 py-3 text-sm"><div className="flex justify-between"><b>v{v.version}</b><span className="text-xs text-muted">{fmtDate(v.releasedAt)}</span></div>{v.compatibility && <p className="text-xs text-muted">Compatibility: {v.compatibility}</p>}<p className="mt-1 whitespace-pre-wrap text-muted">{v.changelog}</p></li>)}</ul>
          </Card>

          <section aria-labelledby="reviews" className="space-y-3">
            <h2 id="reviews" className="text-lg font-semibold">Reviews</h2>
            {l.reviews.length === 0 ? <p className="text-sm text-muted">No reviews yet.</p> : l.reviews.map((r) => (
              <Card key={r.id} className="p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2"><Stars avg={r.rating} count={1} /><span className="flex items-center gap-2">{r.verifiedPurchase ? <Badge tone="up">Verified purchase</Badge> : <Badge>Verified user</Badge>}<span className="text-xs text-muted">{fmtDate(r.createdAt)}</span></span></div>
                {r.title && <p className="mt-2 font-medium">{r.title}</p>}{r.body && <p className="mt-1 whitespace-pre-wrap text-muted">{r.body}</p>}
                <div className="mt-2 flex items-center justify-between text-xs text-muted"><span>{r.user.name?.split(" ")[0] ?? "Member"}</span>{viewer && <ReportForm reviewId={r.id} />}</div>
              </Card>
            ))}
            {reviewGate.ok && <Card className="p-4"><h3 className="mb-3 text-sm font-semibold">{myReview ? "Update your review" : "Write a review"}</h3><ReviewForm listingId={l.id} /></Card>}
            {viewer && !reviewGate.ok && !l.isOwner && !license && <p className="text-xs text-muted">Only people who have access to this product can review it.</p>}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="space-y-4 p-4">
            <div><p className="text-2xl font-semibold">{priceLabel(l.pricingModel, l.priceUsdCents)}</p>{l.pricingModel !== "FREE" && <p className="text-xs text-muted">or {ngnShort(l.priceUsdCents, settings.ngnPerUsd)}{l.pricingModel === "MONTHLY" ? "/month" : l.pricingModel === "YEARLY" ? "/year" : ""}</p>}</div>
            {l.isOwner ? <LinkButton href={`/creator/listings/${l.id}`} variant="secondary" className="w-full">Edit your listing</LinkButton>
              : active && !canRenew ? <div className="space-y-2"><p className="rounded-lg bg-up-soft px-3 py-2 text-sm text-up">You have access{license?.currentPeriodEnd ? ` until ${fmtDate(license.currentPeriodEnd)}` : ""}.</p><LinkButton href="/library" variant="secondary" className="w-full">Open My Indicators</LinkButton></div>
              : live ? <BuyBox listingId={l.id} model={l.pricingModel} cents={l.priceUsdCents} ngnRate={settings.ngnPerUsd} tradingViewAccess={l.tradingViewAccess} loggedIn={!!viewer} callbackUrl={`/market/${l.slug}`} label={buyLabel} />
              : <p className="text-sm text-muted">Not available for purchase yet.</p>}
          </Card>
          <Card className="p-4 text-sm">
            <h3 className="mb-3 font-semibold">Product details</h3>
            <dl className="space-y-2.5 text-muted">
              <Row k="Supported markets" v={l.indicator.markets.join(", ") || "—"} />
              <Row k="Timeframes" v={l.indicator.timeframes.join(", ") || "—"} />
              <Row k="Version" v={`v${l.indicator.latestVersion}${l.indicator.pineVersion ? ` · Pine v${l.indicator.pineVersion}` : ""}`} />
              <Row k="Updates" v={l.pricingModel === "MONTHLY" || l.pricingModel === "YEARLY" ? "All updates while subscribed" : POLICY[l.updatePolicy]} />
              <Row k="Delivery" v={l.tradingViewAccess ? "TradingView invite-only access, granted by the creator" : l.sourceIncluded ? "Pine Script source code" : "Protected access"} />
            </dl>
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs">{protectedProduct ? <><Lock size={14} className="mt-0.5 shrink-0 text-accent" /><span><b className="text-fg">Protected indicator.</b> You get access to use it. The creator&apos;s source code is not included.</span></> : <><Unlock size={14} className="mt-0.5 shrink-0 text-warn" /><span><b className="text-fg">Source code included.</b> The creator provides the Pine Script source with your purchase.</span></>}</p>
            {l.allowBuyerBacktest && <p className="mt-2 text-xs text-muted">Buyers can run this strategy on their own data in the Indicator Lab.</p>}
          </Card>
          <Card className="p-4 text-xs text-muted">
            <p className="font-semibold text-fg">Trust checklist</p>
            <ul className="mt-2 space-y-1.5">
              <li>{l.creator.verified ? "✓ Verified creator" : "○ Creator not yet verified"}</li>
              <li>{l.evidence.length ? `✓ ${l.evidence.length} backtest${l.evidence.length === 1 ? "" : "s"} with full assumptions` : "○ No backtests published"}</li>
              <li>{l.evidence.some((e) => e.run.sampleType === "OUT_OF_SAMPLE") ? "✓ Includes out-of-sample results" : "○ No out-of-sample results"}</li>
              <li>{l.methodology ? "✓ Methodology described" : "○ Methodology not described"}</li>
              <li>✓ Version history shown</li>
            </ul>
            <div className="mt-3">{viewer ? <ReportForm listingId={l.id} /> : <Link href="/login" className="underline">Sign in to report</Link>}</div>
          </Card>
        </aside>
      </div>
      <p className="border-t border-line pt-4 text-xs text-muted">Creators are responsible for their listings. This is not financial advice and no result is guaranteed. Trading leveraged products involves substantial risk. Always verify what you are buying and test before you rely on it.</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3"><dt>{k}</dt><dd className="text-right text-fg">{v}</dd></div>;
}
