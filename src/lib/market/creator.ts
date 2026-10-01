import "server-only";
import { prisma } from "@/lib/db";
import { cleanText } from "@/lib/sanitize";
import { encryptSecret, hintOf } from "@/lib/secrets";
import { computeBalances } from "./fees";
import { bucketRevenue, ratio } from "./analytics";
import { getMarketSettings } from "./settings";
import { ratingStats } from "./listings";

export type Result<T> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });

export type PayoutStatusLabel = "NOT_SET" | "PENDING_VERIFICATION" | "READY";
export const payoutStatusOf = (c: { payoutMethodEnc: string | null; payoutVerifiedAt: Date | null }): PayoutStatusLabel => (!c.payoutMethodEnc ? "NOT_SET" : c.payoutVerifiedAt ? "READY" : "PENDING_VERIFICATION");

/** Payout details are encrypted at rest. Changing them requires admin re-verification. */
export async function setPayoutMethod(userId: string, text: string): Promise<Result<object>> {
  const t = cleanText(text, 300);
  if (t.length < 8) return fail("Enter your bank name, account number and account name (at least 8 characters).");
  const c = await prisma.creator.findUnique({ where: { userId } });
  if (!c) return fail("Create your creator profile first.");
  await prisma.creator.update({ where: { id: c.id }, data: { payoutMethodEnc: encryptSecret(t), payoutMethodHint: hintOf(t), payoutVerifiedAt: null } });
  return { ok: true };
}

export async function creatorBalances(creatorId: string, now = new Date()) {
  const [entries, payouts] = await Promise.all([
    prisma.ledgerEntry.findMany({ where: { creatorId }, select: { amountUsdCents: true, availableAt: true } }),
    prisma.payout.findMany({ where: { creatorId }, select: { amountUsdCents: true, status: true } }),
  ]);
  return computeBalances(entries, payouts, now);
}

/** Pays out the whole available balance. Serializable so two clicks can't both succeed. */
export async function requestPayout(userId: string): Promise<Result<{ amountUsdCents: number }>> {
  const settings = await getMarketSettings();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const c = await tx.creator.findUnique({ where: { userId } });
        if (!c) return fail("Create your creator profile first.");
        if (c.status !== "ACTIVE") return fail("Your creator account is suspended.");
        if (payoutStatusOf(c) !== "READY") return fail("Add your payout details and wait for verification before requesting a payout.");
        const [entries, payouts] = await Promise.all([
          tx.ledgerEntry.findMany({ where: { creatorId: c.id }, select: { amountUsdCents: true, availableAt: true } }),
          tx.payout.findMany({ where: { creatorId: c.id }, select: { amountUsdCents: true, status: true } }),
        ]);
        if (payouts.some((p) => p.status === "REQUESTED" || p.status === "PROCESSING")) return fail("You already have a payout in progress.");
        const b = computeBalances(entries, payouts, new Date());
        if (b.availableCents < settings.minPayoutUsdCents) return fail(`The minimum payout is $${(settings.minPayoutUsdCents / 100).toFixed(2)}. Your available balance is $${(b.availableCents / 100).toFixed(2)}.`);
        await tx.payout.create({ data: { creatorId: c.id, amountUsdCents: b.availableCents, status: "REQUESTED" } });
        return { ok: true as const, amountUsdCents: b.availableCents };
      }, { isolationLevel: "Serializable" });
    } catch (e) {
      if (attempt === 2 || !(e instanceof Error) || !/serializ|deadlock|could not/i.test(e.message)) throw e;
    }
  }
  return fail("Please try again.");
}

export async function creatorOverview(userId: string, now = new Date()) {
  const creator = await prisma.creator.findUnique({ where: { userId } });
  if (!creator) return null;
  const listings = await prisma.listing.findMany({
    where: { creatorId: creator.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, slug: true, title: true, status: true, rejectionReason: true, pricingModel: true, priceUsdCents: true, views: true, createdAt: true, indicator: { select: { id: true, name: true, visibility: true, latestVersion: true } } },
  });
  const ids = listings.map((l) => l.id);
  const [orderGroups, licenses, stats, ledger, payouts, recent, grants] = await Promise.all([
    prisma.marketOrder.groupBy({ by: ["listingId", "status"], where: { creatorId: creator.id, status: { in: ["PAID", "REFUNDED"] } }, _count: { _all: true }, _sum: { creatorEarningUsdCents: true, grossUsdCents: true } }),
    prisma.license.findMany({ where: { listingId: { in: ids } }, select: { listingId: true, status: true, type: true, currentPeriodEnd: true } }),
    ratingStats(ids),
    prisma.ledgerEntry.findMany({ where: { creatorId: creator.id }, select: { amountUsdCents: true, availableAt: true, createdAt: true, orderId: true } }),
    prisma.payout.findMany({ where: { creatorId: creator.id }, orderBy: { requestedAt: "desc" }, take: 20 }),
    prisma.marketOrder.findMany({ where: { creatorId: creator.id }, orderBy: { createdAt: "desc" }, take: 15, select: { id: true, status: true, grossUsdCents: true, creatorEarningUsdCents: true, createdAt: true, listing: { select: { title: true } } } }),
    prisma.license.findMany({ where: { listing: { creatorId: creator.id, tradingViewAccess: true }, status: "ACTIVE", tradingViewUsername: { not: null }, accessGrantedAt: null }, select: { id: true, tradingViewUsername: true, listing: { select: { title: true } } } }),
  ]);

  const rows = listings.map((l) => {
    const paid = orderGroups.find((g) => g.listingId === l.id && g.status === "PAID");
    const refunded = orderGroups.find((g) => g.listingId === l.id && g.status === "REFUNDED");
    const ls = licenses.filter((x) => x.listingId === l.id);
    const subscribers = ls.filter((x) => (x.type === "MONTHLY" || x.type === "YEARLY") && x.status === "ACTIVE" && x.currentPeriodEnd && x.currentPeriodEnd > now).length;
    const sales = (paid?._count._all ?? 0) + (refunded?._count._all ?? 0);
    const refunds = refunded?._count._all ?? 0;
    const revenue = (paid?._sum.creatorEarningUsdCents ?? 0);
    const access = ls.filter((x) => x.status === "ACTIVE").length;
    return { ...l, sales, refunds, subscribers, access, revenueCents: revenue, refundRate: ratio(refunds, sales), conversion: ratio(access, l.views), rating: stats.get(l.id) ?? { avg: 0, count: 0 } };
  });

  const totalViews = rows.reduce((a, r) => a + r.views, 0);
  const totalAccess = rows.reduce((a, r) => a + r.access, 0);
  const totalSales = rows.reduce((a, r) => a + r.sales, 0);
  const totalRefunds = rows.reduce((a, r) => a + r.refunds, 0);
  const revenueEntries = ledger.map((e) => ({ amountUsdCents: e.amountUsdCents, createdAt: e.createdAt }));
  return {
    creator, rows, recent, grants, payouts,
    balances: computeBalances(ledger, payouts, now),
    totals: { views: totalViews, access: totalAccess, sales: totalSales, refunds: totalRefunds, conversion: ratio(totalAccess, totalViews), refundRate: ratio(totalRefunds, totalSales), subscribers: rows.reduce((a, r) => a + r.subscribers, 0) },
    revenue: { day: bucketRevenue(revenueEntries, "day", 14, now), week: bucketRevenue(revenueEntries, "week", 12, now), month: bucketRevenue(revenueEntries, "month", 12, now) },
    top: [...rows].sort((a, b) => b.revenueCents - a.revenueCents).filter((r) => r.revenueCents > 0).slice(0, 5),
    payoutStatus: payoutStatusOf(creator),
  };
}

/** The 8-step creator journey, derived from real data. */
export async function creatorChecklist(userId: string) {
  const creator = await prisma.creator.findUnique({ where: { userId }, select: { id: true } });
  const listing = creator ? await prisma.listing.findFirst({ where: { creatorId: creator.id }, orderBy: { updatedAt: "desc" }, select: { id: true, status: true, documentation: true, pricingModel: true, priceUsdCents: true, indicator: { select: { versions: { select: { id: true } } } } } }) : null;
  const sales = creator ? await prisma.marketOrder.count({ where: { creatorId: creator.id, status: "PAID" } }) : 0;
  const hasInd = (await prisma.indicator.count({ where: { userId } })) > 0;
  const status = listing?.status;
  return [
    { n: 1, label: "Create your creator profile", done: !!creator, href: "/creator/profile" },
    { n: 2, label: "Add an indicator", done: hasInd, href: "/lab/indicators/new" },
    { n: 3, label: "Write documentation", done: !!listing && listing.documentation.trim().length >= 80, href: listing ? `/creator/listings/${listing.id}` : "/lab" },
    { n: 4, label: "Configure pricing", done: !!listing && (listing.pricingModel === "FREE" || listing.priceUsdCents > 0), href: listing ? `/creator/listings/${listing.id}` : "/lab" },
    { n: 5, label: "Submit for review", done: !!status && status !== "DRAFT" && status !== "REJECTED", href: listing ? `/creator/listings/${listing.id}` : "/lab" },
    { n: 6, label: "Marketplace approval", done: status === "APPROVED", href: listing ? `/creator/listings/${listing.id}` : "/lab" },
    { n: 7, label: "Publish (set visibility)", done: status === "APPROVED", href: hasInd ? "/lab" : "/lab/indicators/new" },
    { n: 8, label: "Receive sales", done: sales > 0, href: "/creator" },
  ];
}
