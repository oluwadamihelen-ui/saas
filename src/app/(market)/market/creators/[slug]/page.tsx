import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { ListingCard } from "@/components/market/parts";
import { prisma } from "@/lib/db";
import { ratingStats } from "@/lib/market/listings";

export const metadata: Metadata = { title: "Creator" };

export default async function CreatorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await prisma.creator.findUnique({ where: { slug }, select: { id: true, displayName: true, bio: true, website: true, verified: true, status: true, createdAt: true } });
  if (!c || c.status !== "ACTIVE") notFound();
  const listings = await prisma.listing.findMany({
    where: { creatorId: c.id, status: "APPROVED", indicator: { visibility: "PUBLIC" } }, orderBy: { approvedAt: "desc" },
    select: { id: true, slug: true, title: true, tagline: true, categories: true, pricingModel: true, priceUsdCents: true, sourceIncluded: true, indicator: { select: { markets: true, timeframes: true, latestVersion: true } }, creator: { select: { displayName: true, slug: true, verified: true } } },
  });
  const stats = await ratingStats(listings.map((l) => l.id));
  return (
    <>
      <div className="mb-6"><h1 className="flex items-center gap-2 text-2xl font-semibold">{c.displayName}{c.verified && <BadgeCheck size={20} className="text-accent" aria-label="Verified creator" />}</h1>
        {c.bio && <p className="mt-2 max-w-2xl whitespace-pre-wrap text-muted">{c.bio}</p>}
        {c.website && <a href={c.website} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 inline-block text-sm text-accent hover:underline">{c.website}</a>}
        <p className="mt-2 text-xs text-muted">{c.verified ? "Identity verified by RiskPilot." : "Not yet verified."} Member since {c.createdAt.toISOString().slice(0, 7)}.</p></div>
      {listings.length === 0 ? <p className="text-sm text-muted">No public products yet.</p> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{listings.map((l) => <ListingCard key={l.id} l={{ ...l, rating: stats.get(l.id) ?? { avg: 0, count: 0 } }} />)}</div>}
    </>
  );
}
