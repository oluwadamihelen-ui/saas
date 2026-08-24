import { prisma } from "./db";

export interface RevenueAnalytics {
  totals: {
    coinRevenue: number;
    publisherShare: number;
    platformShare: number;
    unlockCount: number;
    distinctViewers: number;
    avgRevenuePerViewer: number;
  };
  dailyRevenue: { date: string; coins: number }[];
  topProjects: { projectTitle: string; coins: number; unlockCount: number }[];
  topPublishers: { publisherId: string | null; name: string; coins: number }[];
}

const DAILY_WINDOW_DAYS = 30;

/**
 * Revenue-only analytics — deliberately scoped to what RevenueTransaction
 * can actually answer. A "conversion rate" (viewers who watched vs. who
 * paid) would need ViewingEvent data, but that model is schema-only —
 * nothing anywhere writes a ViewingEvent row today, so a conversion
 * metric here would be fabricated from a table that's always empty.
 * Left out rather than faked; wiring player-side ViewingEvent writes is
 * a real follow-up, not something this function can paper over.
 */
export async function getRevenueAnalytics(): Promise<RevenueAnalytics> {
  const windowStart = new Date(Date.now() - DAILY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [totalsAgg, viewerRows, recentTx, topProjectsRaw, topPublishersRaw] = await Promise.all([
    prisma.revenueTransaction.aggregate({
      _sum: { coinAmount: true, publisherShareCoins: true, platformShareCoins: true },
      _count: true,
    }),
    prisma.revenueTransaction.findMany({ where: { viewerId: { not: null } }, distinct: ["viewerId"], select: { viewerId: true } }),
    prisma.revenueTransaction.findMany({ where: { createdAt: { gte: windowStart } }, select: { createdAt: true, coinAmount: true } }),
    prisma.revenueTransaction.groupBy({
      by: ["projectTitle"],
      _sum: { coinAmount: true },
      _count: true,
      orderBy: { _sum: { coinAmount: "desc" } },
      take: 10,
    }),
    prisma.revenueTransaction.groupBy({
      by: ["publisherId"],
      _sum: { publisherShareCoins: true },
      orderBy: { _sum: { publisherShareCoins: "desc" } },
      take: 10,
    }),
  ]);

  // Zero-filled so a quiet day shows as a real zero bar, not a gap.
  const dailyMap = new Map<string, number>();
  for (let i = 0; i < DAILY_WINDOW_DAYS; i++) {
    const key = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    dailyMap.set(key, 0);
  }
  for (const tx of recentTx) {
    const key = tx.createdAt.toISOString().slice(0, 10);
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + tx.coinAmount);
  }
  const dailyRevenue = [...dailyMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, coins]) => ({ date, coins }));

  const publisherIds = topPublishersRaw.map((p) => p.publisherId).filter((id): id is string => id !== null);
  const publishers = await prisma.user.findMany({ where: { id: { in: publisherIds } }, select: { id: true, name: true, email: true } });
  const publisherName = new Map(publishers.map((p) => [p.id, p.name ?? p.email]));

  const coinRevenue = totalsAgg._sum.coinAmount ?? 0;
  const distinctViewers = viewerRows.length;

  return {
    totals: {
      coinRevenue,
      publisherShare: totalsAgg._sum.publisherShareCoins ?? 0,
      platformShare: totalsAgg._sum.platformShareCoins ?? 0,
      unlockCount: totalsAgg._count,
      distinctViewers,
      avgRevenuePerViewer: distinctViewers > 0 ? coinRevenue / distinctViewers : 0,
    },
    dailyRevenue,
    topProjects: topProjectsRaw.map((p) => ({ projectTitle: p.projectTitle, coins: p._sum.coinAmount ?? 0, unlockCount: p._count })),
    topPublishers: topPublishersRaw.map((p) => ({
      publisherId: p.publisherId,
      name: p.publisherId ? (publisherName.get(p.publisherId) ?? "Unknown") : "Deleted account",
      coins: p._sum.publisherShareCoins ?? 0,
    })),
  };
}
