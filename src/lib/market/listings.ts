import "server-only";
import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { cleanText } from "@/lib/sanitize";
import { MAX_UPLOAD_BYTES, getStorage, sniffImage } from "@/lib/storage";
import { checkMarketingClaims } from "./claims";
import { getMarketSettings } from "./settings";
import { DEFAULT_CATEGORIES } from "./settings-defaults";
import { validatePrice } from "./licensing";
import type { Prisma } from "@prisma/client";

export type Result<T> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });

export const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "item";

// ------------------------------------------------------------------ creator profile

export async function ensureCreator(userId: string, p: { displayName: string; slug?: string; bio?: string; website?: string }): Promise<Result<{ id: string }>> {
  const name = cleanText(p.displayName, 60);
  if (name.length < 2) return fail("Choose a display name (at least 2 characters).");
  const claims = checkMarketingClaims(p.bio, name);
  if (!claims.ok) return fail(`Your profile can't include: ${claims.matches.join(", ")}.`);
  const website = p.website ? cleanText(p.website, 200) : null;
  if (website && !/^https:\/\/[^\s]+\.[^\s]+$/.test(website)) return fail("Website must start with https://");
  const existing = await prisma.creator.findUnique({ where: { userId } });
  if (existing) {
    await prisma.creator.update({ where: { id: existing.id }, data: { displayName: name, bio: cleanText(p.bio ?? "", 1000), website } });
    return { ok: true, id: existing.id };
  }
  let slug = slugify(p.slug || name);
  while (await prisma.creator.findUnique({ where: { slug } })) slug = `${slugify(p.slug || name)}-${randomUUID().slice(0, 4)}`;
  const c = await prisma.creator.create({ data: { userId, displayName: name, slug, bio: cleanText(p.bio ?? "", 1000), website } });
  return { ok: true, id: c.id };
}

// ------------------------------------------------------------------ listing (creator side)

export async function createListing(userId: string, indicatorId: string): Promise<Result<{ id: string }>> {
  const creator = await prisma.creator.findUnique({ where: { userId } });
  if (!creator) return fail("Create your creator profile first.");
  if (creator.status !== "ACTIVE") return fail("Your creator account is suspended.");
  const ind = await prisma.indicator.findFirst({ where: { id: indicatorId, userId }, include: { listing: { select: { id: true } } } });
  if (!ind) return fail("Indicator not found.");
  if (ind.listing) return { ok: true, id: ind.listing.id };
  let slug = slugify(ind.name);
  while (await prisma.listing.findUnique({ where: { slug } })) slug = `${slugify(ind.name)}-${randomUUID().slice(0, 4)}`;
  const l = await prisma.listing.create({
    data: { indicatorId: ind.id, creatorId: creator.id, slug, title: ind.name, description: ind.description, categories: [] },
  });
  return { ok: true, id: l.id };
}

const VIDEO_HOSTS = ["youtube.com", "www.youtube.com", "youtu.be", "vimeo.com", "www.vimeo.com", "loom.com", "www.loom.com"];

export const listingInputSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(80),
  tagline: z.string().max(140),
  description: z.string().max(5000),
  categories: z.array(z.string()).max(5),
  features: z.array(z.string().max(120)).max(12),
  documentation: z.string().max(20_000),
  methodology: z.string().max(4000),
  dataSourceNote: z.string().max(1000),
  demoVideoUrl: z.string().max(300).nullable(),
  pricingModel: z.enum(["FREE", "ONE_TIME", "MONTHLY", "YEARLY"]),
  priceUsd: z.number().min(0).max(100_000),
  sourceIncluded: z.boolean(),
  updatePolicy: z.enum(["ALL_UPDATES", "SAME_MAJOR", "NO_UPDATES"]),
  tradingViewAccess: z.boolean(),
  allowBuyerBacktest: z.boolean(),
  strategyId: z.string().nullable(),
});
export type ListingInput = z.infer<typeof listingInputSchema>;

function marketingTexts(i: ListingInput) {
  return [i.title, i.tagline, i.description, ...i.features, i.documentation, i.methodology, i.dataSourceNote];
}

export async function updateListing(userId: string, listingId: string, raw: unknown): Promise<Result<object>> {
  const listing = await prisma.listing.findFirst({ where: { id: listingId, creator: { userId } }, include: { creator: true } });
  if (!listing) return fail("Listing not found.");
  if (listing.creator.status !== "ACTIVE") return fail("Your creator account is suspended.");
  const parsed = listingInputSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid listing");
  const i = parsed.data;

  const claims = checkMarketingClaims(...marketingTexts(i));
  if (!claims.ok) return fail(`Marketplace rules don't allow these claims: ${claims.matches.join(", ")}. Describe what the product does, not promised results.`);

  const settings = await getMarketSettings();
  const cents = Math.round(i.priceUsd * 100);
  const priceErr = validatePrice(i.pricingModel, i.pricingModel === "FREE" ? 0 : cents, settings.priceLimits);
  if (priceErr) return fail(priceErr);

  const cats = await prisma.category.findMany({ where: { slug: { in: i.categories }, active: true }, select: { slug: true } });
  if (cats.length !== i.categories.length) return fail("One of the selected categories doesn't exist.");

  let video: string | null = null;
  if (i.demoVideoUrl && i.demoVideoUrl.trim()) {
    try {
      const u = new URL(i.demoVideoUrl.trim());
      if (u.protocol !== "https:" || !VIDEO_HOSTS.includes(u.hostname)) throw new Error();
      video = u.toString();
    } catch { return fail("Demo video must be an https link from YouTube, Vimeo or Loom."); }
  }
  if (i.allowBuyerBacktest) {
    if (!i.strategyId) return fail("Choose which strategy buyers may test.");
    const own = await prisma.strategy.findFirst({ where: { id: i.strategyId, userId }, select: { id: true } });
    if (!own) return fail("Strategy not found.");
  }

  await prisma.listing.update({
    where: { id: listingId },
    data: {
      title: cleanText(i.title, 80), tagline: cleanText(i.tagline, 140), description: cleanText(i.description, 5000), categories: i.categories,
      features: i.features.map((f) => cleanText(f, 120)).filter(Boolean), documentation: cleanText(i.documentation, 20_000), methodology: cleanText(i.methodology, 4000),
      dataSourceNote: cleanText(i.dataSourceNote, 1000), demoVideoUrl: video, pricingModel: i.pricingModel, priceUsdCents: i.pricingModel === "FREE" ? 0 : cents,
      sourceIncluded: i.sourceIncluded, updatePolicy: i.updatePolicy, tradingViewAccess: i.tradingViewAccess, allowBuyerBacktest: i.allowBuyerBacktest,
      strategyId: i.allowBuyerBacktest ? i.strategyId : null,
    },
  });
  return { ok: true };
}

// ------------------------------------------------------------------ media & evidence

export async function addScreenshot(userId: string, listingId: string, file: { name: string; size: number; data: Buffer }, caption: string): Promise<Result<{ id: string }>> {
  const listing = await prisma.listing.findFirst({ where: { id: listingId, creator: { userId } }, include: { _count: { select: { media: true } } } });
  if (!listing) return fail("Listing not found.");
  if (listing._count.media >= 8) return fail("You can add up to 8 screenshots.");
  if (file.size > MAX_UPLOAD_BYTES) return fail(`${file.name} is larger than 5 MB.`);
  const kind = sniffImage(file.data);
  if (!kind) return fail(`${file.name} is not a PNG, JPEG or WebP image.`);
  const key = `market/${listingId}/${randomUUID()}.${kind.ext}`;
  await getStorage().put(key, file.data, kind.mime);
  const m = await prisma.listingMedia.create({ data: { listingId, storageKey: key, mimeType: kind.mime, caption: cleanText(caption, 140), sort: listing._count.media } });
  return { ok: true, id: m.id };
}

export async function removeScreenshot(userId: string, mediaId: string) {
  const m = await prisma.listingMedia.findFirst({ where: { id: mediaId, listing: { creator: { userId } } } });
  if (!m) return;
  await getStorage().delete(m.storageKey).catch(() => {});
  await prisma.listingMedia.delete({ where: { id: m.id } });
}

/** Evidence must be a real-data, platform-run test. Imported/unverified and synthetic runs can never be shown as evidence. */
export async function attachEvidence(userId: string, listingId: string, runId: string, note: string): Promise<Result<object>> {
  const listing = await prisma.listing.findFirst({ where: { id: listingId, creator: { userId } }, include: { _count: { select: { evidence: true } } } });
  if (!listing) return fail("Listing not found.");
  const run = await prisma.backtestRun.findFirst({ where: { id: runId, userId } });
  if (!run) return fail("Backtest not found.");
  if (run.synthetic) return fail("Backtests on synthetic demo data can't be used as marketplace evidence.");
  if (run.kind === "IMPORTED") return fail("Imported results aren't verified by RiskPilot, so they can't be used as evidence. Re-run the test on your own candle data.");
  if (run.kind === "OPTIMIZATION") return fail("Choose a single backtest, not a parameter table.");
  if (listing._count.evidence >= 6) return fail("You can show up to 6 backtests.");
  await prisma.listingEvidence.upsert({ where: { listingId_backtestRunId: { listingId, backtestRunId: runId } }, create: { listingId, backtestRunId: runId, note: cleanText(note, 300) }, update: { note: cleanText(note, 300) } });
  return { ok: true };
}

export async function detachEvidence(userId: string, listingId: string, runId: string) {
  await prisma.listingEvidence.deleteMany({ where: { listingId, backtestRunId: runId, listing: { creator: { userId } } } });
}

// ------------------------------------------------------------------ submission

export async function submissionProblems(listingId: string): Promise<string[]> {
  const l = await prisma.listing.findUnique({ where: { id: listingId }, include: { indicator: { include: { versions: { select: { id: true } } } }, evidence: { include: { run: { select: { tradeCount: true, synthetic: true, kind: true } } } }, media: { select: { id: true } } } });
  if (!l) return ["Listing not found."];
  const settings = await getMarketSettings();
  const p: string[] = [];
  if (l.title.trim().length < 3) p.push("Add a title.");
  if (l.description.trim().length < 80) p.push("Write a description of at least 80 characters.");
  if (l.documentation.trim().length < 80) p.push("Add documentation (what it shows, how to install and use it, inputs explained) — at least 80 characters.");
  if (!l.categories.length) p.push("Choose at least one category.");
  if (!l.indicator.markets.length) p.push("Set the supported markets on the indicator.");
  if (!l.indicator.timeframes.length) p.push("Set the supported timeframes on the indicator.");
  if (!l.indicator.versions.length) p.push("Add a version.");
  if (l.indicator.visibility === "PRIVATE") p.push("Set the indicator's visibility to Unlisted or Public — Private indicators can't be listed.");
  const priceErr = validatePrice(l.pricingModel, l.priceUsdCents, settings.priceLimits);
  if (priceErr) p.push(priceErr);
  const claims = checkMarketingClaims(l.title, l.tagline, l.description, ...l.features, l.documentation, l.methodology, l.dataSourceNote);
  if (!claims.ok) p.push(`Remove unsupported claims: ${claims.matches.join(", ")}.`);
  if (l.pricingModel !== "FREE") {
    const solid = l.evidence.filter((e) => !e.run.synthetic && e.run.kind !== "IMPORTED" && e.run.tradeCount >= settings.minEvidenceTrades);
    if (!solid.length) p.push(`Paid products must show at least one backtest on real data with ${settings.minEvidenceTrades}+ trades, with all assumptions visible.`);
    if (l.methodology.trim().length < 40) p.push("Describe your backtest methodology (at least 40 characters).");
    if (l.dataSourceNote.trim().length < 10) p.push("Say where your test data came from.");
  }
  if (l.allowBuyerBacktest && !l.strategyId) p.push("Pick the strategy buyers may test, or turn the option off.");
  return p;
}

export async function submitForReview(userId: string, listingId: string): Promise<Result<object>> {
  const l = await prisma.listing.findFirst({ where: { id: listingId, creator: { userId } }, include: { creator: true } });
  if (!l) return fail("Listing not found.");
  if (l.creator.status !== "ACTIVE") return fail("Your creator account is suspended.");
  if (l.status === "PENDING_REVIEW") return fail("Already submitted for review.");
  if (l.status === "APPROVED") return fail("This listing is already approved.");
  if (l.status === "SUSPENDED") return fail("This listing is suspended. Contact support.");
  const problems = await submissionProblems(listingId);
  if (problems.length) return fail(problems[0]);
  await prisma.listing.update({ where: { id: listingId }, data: { status: "PENDING_REVIEW", submittedAt: new Date(), rejectionReason: null } });
  return { ok: true };
}

// ------------------------------------------------------------------ public reads (NO source code anywhere)

export const isPubliclyViewable = (l: { status: string; indicator: { visibility: string }; creator: { status: string } }) =>
  l.status === "APPROVED" && l.indicator.visibility !== "PRIVATE" && l.creator.status === "ACTIVE";

export interface SearchParams {
  q?: string; market?: string; timeframe?: string; category?: string; price?: "free" | "paid"; maxPrice?: number; minRating?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "rating" | "reviews";
}

const cardSelect = {
  id: true, slug: true, title: true, tagline: true, categories: true, pricingModel: true, priceUsdCents: true, sourceIncluded: true, approvedAt: true, createdAt: true,
  indicator: { select: { markets: true, timeframes: true, latestVersion: true, kind: true } },
  creator: { select: { displayName: true, slug: true, verified: true } },
} satisfies Prisma.ListingSelect;

export async function ratingStats(listingIds: string[]) {
  const rows = await prisma.review.groupBy({ by: ["listingId"], where: { listingId: { in: listingIds }, status: "VISIBLE" }, _avg: { rating: true }, _count: { _all: true } });
  return new Map(rows.map((r) => [r.listingId, { avg: r._avg.rating ?? 0, count: r._count._all }]));
}

export async function searchListings(p: SearchParams) {
  const where: Prisma.ListingWhereInput = { status: "APPROVED", indicator: { visibility: "PUBLIC" }, creator: { status: "ACTIVE" } };
  const and: Prisma.ListingWhereInput[] = [];
  const q = p.q?.trim().slice(0, 80);
  if (q) and.push({ OR: [{ title: { contains: q, mode: "insensitive" } }, { tagline: { contains: q, mode: "insensitive" } }, { creator: { displayName: { contains: q, mode: "insensitive" } } }, { indicator: { name: { contains: q, mode: "insensitive" } } }] });
  if (p.market) and.push({ indicator: { markets: { has: p.market.toUpperCase() } } });
  if (p.timeframe) and.push({ indicator: { timeframes: { has: p.timeframe.toUpperCase() } } });
  if (p.category) and.push({ categories: { has: p.category } });
  if (p.price === "free") and.push({ pricingModel: "FREE" });
  if (p.price === "paid") and.push({ pricingModel: { not: "FREE" } });
  if (p.maxPrice && p.maxPrice > 0) and.push({ priceUsdCents: { lte: Math.round(p.maxPrice * 100) } });
  if (and.length) where.AND = and;
  const orderBy: Prisma.ListingOrderByWithRelationInput = p.sort === "price_asc" ? { priceUsdCents: "asc" } : p.sort === "price_desc" ? { priceUsdCents: "desc" } : { approvedAt: "desc" };
  const rows = await prisma.listing.findMany({ where, orderBy, select: cardSelect, take: 100 });
  const stats = await ratingStats(rows.map((r) => r.id));
  let out = rows.map((r) => ({ ...r, rating: stats.get(r.id) ?? { avg: 0, count: 0 } }));
  if (p.minRating) out = out.filter((r) => r.rating.avg >= (p.minRating as number));
  if (p.sort === "rating") out.sort((a, b) => b.rating.avg - a.rating.avg || b.rating.count - a.rating.count);
  if (p.sort === "reviews") out.sort((a, b) => b.rating.count - a.rating.count);
  return out;
}

export async function listCategories() {
  // First run: create the default categories (admins can rename/hide/add more).
  if ((await prisma.category.count()) === 0) {
    await prisma.category.createMany({ data: DEFAULT_CATEGORIES.map((c, i) => ({ ...c, sort: i })), skipDuplicates: true });
  }
  return prisma.category.findMany({ where: { active: true }, orderBy: [{ sort: "asc" }, { name: "asc" }] });
}

export interface Viewer { id: string; role: "USER" | "ADMIN" }

/** Public listing page data. Non-public listings are only visible to their creator and admins. */
export async function getListingPage(slug: string, viewer: Viewer | null) {
  const l = await prisma.listing.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, title: true, tagline: true, description: true, categories: true, features: true, documentation: true, methodology: true, dataSourceNote: true, demoVideoUrl: true,
      pricingModel: true, priceUsdCents: true, status: true, rejectionReason: true, sourceIncluded: true, updatePolicy: true, tradingViewAccess: true, allowBuyerBacktest: true, approvedAt: true, createdAt: true,
      indicator: { select: { id: true, name: true, markets: true, timeframes: true, visibility: true, latestVersion: true, pineVersion: true, kind: true,
        versions: { orderBy: { releasedAt: "desc" }, select: { id: true, version: true, changelog: true, compatibility: true, releasedAt: true } } } },
      creator: { select: { id: true, userId: true, displayName: true, slug: true, verified: true, bio: true, status: true, website: true } },
      media: { orderBy: { sort: "asc" }, select: { id: true, caption: true } },
      evidence: { orderBy: { createdAt: "asc" }, select: { id: true, note: true, run: { select: { id: true, sampleType: true, kind: true, label: true, config: true, dataSource: true, tradeCount: true, summary: true, report: true, createdAt: true } } } },
      reviews: { where: { status: "VISIBLE" }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, rating: true, title: true, body: true, verifiedPurchase: true, createdAt: true, user: { select: { name: true } } } },
    },
  });
  if (!l) return null;
  const isOwner = !!viewer && viewer.id === l.creator.userId;
  const isAdmin = viewer?.role === "ADMIN";
  if (!isPubliclyViewable(l) && !isOwner && !isAdmin) return null;
  // Evidence: keep the equity curve and stats, drop the per-trade list.
  const evidence = l.evidence.map((e) => {
    const { trades: _t, ...rest } = (e.run.report ?? {}) as { trades?: unknown };
    void _t;
    return { ...e, run: { ...e.run, report: rest } };
  });
  const stats = await ratingStats([l.id]);
  return { ...l, evidence, rating: stats.get(l.id) ?? { avg: 0, count: 0 }, isOwner, isAdmin };
}

export async function recordView(listingId: string) {
  const day = new Date().toISOString().slice(0, 10);
  await prisma.$transaction([
    prisma.listingViewDay.upsert({ where: { listingId_day: { listingId, day } }, create: { listingId, day, views: 1 }, update: { views: { increment: 1 } } }),
    prisma.listing.update({ where: { id: listingId }, data: { views: { increment: 1 } } }),
  ]);
}

/** Free-form comparison of documented historical test metrics. Nothing is ranked. */
export async function compareEvidence(listingIds: string[]) {
  const ls = await prisma.listing.findMany({
    where: { id: { in: listingIds.slice(0, 4) }, status: "APPROVED", indicator: { visibility: { not: "PRIVATE" } }, creator: { status: "ACTIVE" } },
    select: { id: true, slug: true, title: true, creator: { select: { displayName: true, verified: true } }, evidence: { orderBy: { createdAt: "asc" }, take: 1, select: { run: { select: { sampleType: true, config: true, summary: true, tradeCount: true, dataSource: true } } } } },
  });
  return ls;
}
