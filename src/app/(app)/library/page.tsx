import type { Metadata } from "next";
import Link from "next/link";
import { Download, FlaskConical } from "lucide-react";
import { Badge, Card, Empty, LinkButton, PageHeader } from "@/components/ui";
import { TvUsernameForm } from "@/components/market/client";
import { getUser } from "@/lib/session";
import { buyerLibrary, entitledVersions } from "@/lib/market/access";
import { priceLabel } from "@/lib/market/format";
import { fmtDate } from "@/lib/utils";

export const metadata: Metadata = { title: "My Indicators" };

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams;
  const user = await getUser();
  const items = await buyerLibrary(user.id);
  const withVersions = await Promise.all(items.map(async (i) => ({ ...i, versions: i.active ? await entitledVersions(user.id, i.listing.id) : [] })));
  return (
    <>
      <PageHeader title="My Indicators" subtitle="Products you own or subscribe to. You get access to use them; the creator's source code stays private unless they chose to include it." action={<LinkButton href="/market" variant="secondary">Browse marketplace</LinkButton>} />
      {sp.ok && <p className="mb-4 rounded-xl bg-up-soft px-4 py-3 text-sm text-up">{sp.ok}</p>}
      {withVersions.length === 0 ? <Empty title="Nothing here yet" body="Indicators you buy or add for free will appear here with their updates and documentation." action={<LinkButton href="/market">Browse the marketplace</LinkButton>} /> : (
        <div className="space-y-4">{withVersions.map((i) => {
          const sub = i.type === "MONTHLY" || i.type === "YEARLY";
          return (
            <Card key={i.id} className="p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><Link href={`/market/${i.listing.slug}`} className="text-lg font-semibold hover:underline">{i.listing.title}</Link><p className="text-sm text-muted">by {i.listing.creator.displayName} · latest v{i.listing.indicator.latestVersion}</p></div>
                <div className="flex flex-wrap items-center gap-2"><Badge tone={i.active ? "up" : "down"}>{i.active ? "Active" : i.status === "REFUNDED" ? "Refunded" : i.status === "REVOKED" ? "Revoked" : "Expired"}</Badge><Badge>{priceLabel(i.type, 0).replace("$0 ", "").replace("Free", "Free")}</Badge></div>
              </div>
              <p className="mt-2 text-xs text-muted">{sub ? (i.currentPeriodEnd ? `${i.active ? "Renews/ends" : "Ended"} ${fmtDate(i.currentPeriodEnd, user.timezone)}` : "") : `Since ${fmtDate(i.startedAt, user.timezone)}`}{i.listing.status !== "APPROVED" && " · This product is currently not listed"}</p>
              {i.active && (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-3 text-sm">
                    <div className="flex flex-wrap gap-2">
                      {i.listing.sourceIncluded && <a href={`/api/market/source/${i.listing.id}`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 text-sm"><Download size={14} /> Download source</a>}
                      {i.listing.allowBuyerBacktest && <LinkButton href={`/library/${i.listing.id}/backtest`} variant="secondary" size="sm"><FlaskConical size={14} /> Test in the Lab</LinkButton>}
                    </div>
                    {!i.listing.sourceIncluded && <p className="text-xs text-muted">Protected product — the creator provides access without sharing source code.</p>}
                    {i.listing.tradingViewAccess && (
                      <div><p className="mb-1 text-xs font-medium text-muted">TradingView access {i.accessGrantedAt ? <Badge tone="up" className="ml-1">granted</Badge> : <Badge tone="warn" className="ml-1">waiting for creator</Badge>}</p><TvUsernameForm listingId={i.listing.id} current={i.tradingViewUsername} /></div>
                    )}
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted">Updates you can access</p>
                    <ul className="max-h-40 space-y-1.5 overflow-auto text-sm">{i.versions.map((v) => <li key={v.id}><b>v{v.version}</b> <span className="text-xs text-muted">{fmtDate(v.releasedAt, user.timezone)}</span><p className="whitespace-pre-wrap text-xs text-muted">{v.changelog}</p></li>)}</ul>
                  </div>
                </div>
              )}
              {i.active && i.listing.documentation && <details className="mt-3"><summary className="cursor-pointer text-sm text-accent">Documentation</summary><p className="mt-2 whitespace-pre-wrap rounded-lg bg-bg/60 p-3 text-sm text-muted">{i.listing.documentation}</p></details>}
              {!i.active && sub && i.status === "ACTIVE" && <div className="mt-3"><LinkButton href={`/market/${i.listing.slug}`} size="sm">Renew access</LinkButton></div>}
            </Card>
          );
        })}</div>
      )}
    </>
  );
}
