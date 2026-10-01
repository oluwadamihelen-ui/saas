import Link from "next/link";
import { BadgeCheck, Lock, Star } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { priceLabel, type PricingModel } from "@/lib/market/format";
import { cn } from "@/lib/utils";

export function Stars({ avg, count, size = 14 }: { avg: number; count: number; size?: number }) {
  if (count === 0) return <span className="text-xs text-muted">No reviews yet</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted" aria-label={`${avg.toFixed(1)} out of 5 from ${count} reviews`}>
      <span className="flex">{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={size} className={i <= Math.round(avg) ? "fill-warn text-warn" : "text-line"} />)}</span>
      <b className="text-fg">{avg.toFixed(1)}</b> ({count})
    </span>
  );
}

export function CreatorName({ name, verified, slug }: { name: string; verified: boolean; slug?: string }) {
  const inner = <span className="inline-flex items-center gap-1">{name}{verified && <BadgeCheck size={14} className="text-accent" aria-label="Verified creator" />}</span>;
  return slug ? <Link href={`/market/creators/${slug}`} className="hover:text-fg">{inner}</Link> : inner;
}

interface CardListing {
  slug: string; title: string; tagline: string; categories: string[]; pricingModel: PricingModel; priceUsdCents: number; sourceIncluded: boolean;
  indicator: { markets: string[]; timeframes: string[]; latestVersion: string };
  creator: { displayName: string; slug: string; verified: boolean };
  rating: { avg: number; count: number };
}

export function ListingCard({ l, compareHref }: { l: CardListing; compareHref?: string }) {
  return (
    <Card className="flex flex-col p-4 transition-colors hover:border-muted/60">
      <Link href={`/market/${l.slug}`} className="flex-1">
        <div className="flex items-start justify-between gap-3"><h3 className="font-semibold leading-snug">{l.title}</h3><Badge tone={l.pricingModel === "FREE" ? "up" : "accent"} className="shrink-0">{priceLabel(l.pricingModel, l.priceUsdCents)}</Badge></div>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{l.tagline || "—"}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">{[...l.indicator.markets.slice(0, 3), ...l.indicator.timeframes.slice(0, 3)].map((t) => <span key={t} className="rounded-md bg-surface-2 px-2 py-0.5 text-[11px] text-muted">{t}</span>)}</div>
      </Link>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs">
        <span className="text-muted">by <CreatorName name={l.creator.displayName} verified={l.creator.verified} slug={l.creator.slug} /></span>
        <Stars avg={l.rating.avg} count={l.rating.count} size={12} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted"><span className="inline-flex items-center gap-1">{!l.sourceIncluded && <><Lock size={11} /> Protected</>}{l.sourceIncluded && "Source included"} · v{l.indicator.latestVersion}</span>{compareHref && <Link href={compareHref} className="hover:text-fg">Compare</Link>}</div>
    </Card>
  );
}

export function Filters({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-2 text-sm", className)}>{children}</div>;
}
