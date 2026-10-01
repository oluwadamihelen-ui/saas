import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { createIndicator, saveStrategy, createSyntheticDataset } from "@/lib/lab/service";
import { ensureCreator, createListing, updateListing } from "@/lib/market/listings";
import { makeUser } from "./helpers";
import type { Actor } from "@/lib/market/admin-core";

export const SECRET = "SECRET_PINE_MARKER_" + randomUUID().slice(0, 8);
export const PINE = `//@version=5\nindicator("Gold Sniper V1", overlay=true)\n// ${SECRET}\nlen = input.int(20, "Length", minval=1)\nplot(ta.ema(close, len))`;

export async function seedCategories() {
  for (const [slug, name] of [["gold", "Gold"], ["trend-following", "Trend Following"], ["forex", "Forex"]]) {
    await prisma.category.upsert({ where: { slug }, create: { slug, name }, update: { active: true } });
  }
}

export async function adminUser() {
  const u = await makeUser({ role: "ADMIN" });
  return { id: u.id, role: "ADMIN" as const } satisfies Actor;
}

export const baseListing = (over: Record<string, unknown> = {}) => ({
  title: "Gold Sniper V1", tagline: "EMA filter with session awareness", description: "A trend filter for XAUUSD that draws the levels you define. ".repeat(3),
  categories: ["gold"], features: ["Session filter", "Configurable EMA"], documentation: "Install the script from TradingView, add it to a chart, then adjust the inputs. ".repeat(3),
  methodology: "Tested on 3 years of H1 candles with spread and commission applied.", dataSourceNote: "Broker export CSV", demoVideoUrl: null,
  pricingModel: "MONTHLY", priceUsd: 19, sourceIncluded: false, updatePolicy: "SAME_MAJOR", tradingViewAccess: false, allowBuyerBacktest: false, strategyId: null, ...over,
});

/** A creator with an indicator + listing. `approve` pushes it through the real submit/review path. */
export async function makeListing(opts: { visibility?: "PRIVATE" | "UNLISTED" | "PUBLIC"; pricing?: "FREE" | "ONE_TIME" | "MONTHLY" | "YEARLY"; price?: number; approve?: boolean; sourceIncluded?: boolean } = {}) {
  await seedCategories();
  const user = await makeUser();
  const c = await ensureCreator(user.id, { displayName: "Test Creator " + randomUUID().slice(0, 4), bio: "Builds indicators." });
  if (!c.ok) throw new Error(c.error);
  const ind = await createIndicator(user.id, "Test Creator", { name: "Gold Sniper V1", description: "desc", markets: ["XAUUSD"], timeframes: ["H1", "H4"], visibility: opts.visibility ?? "PUBLIC", source: PINE });
  if (!ind.ok) throw new Error(ind.error);
  const l = await createListing(user.id, ind.id);
  if (!l.ok) throw new Error(l.error);
  const pricing = opts.pricing ?? "MONTHLY";
  const upd = await updateListing(user.id, l.id, baseListing({ pricingModel: pricing, priceUsd: pricing === "FREE" ? 0 : opts.price ?? 19, sourceIncluded: opts.sourceIncluded ?? false }));
  if (!upd.ok) throw new Error(upd.error);
  if (opts.approve !== false) await prisma.listing.update({ where: { id: l.id }, data: { status: "APPROVED", approvedAt: new Date() } });
  const listing = await prisma.listing.findUniqueOrThrow({ where: { id: l.id } });
  return { user, creatorId: c.id, indicatorId: ind.id, listing };
}

export async function makeEvidenceRun(userId: string, over: Record<string, unknown> = {}) {
  return prisma.backtestRun.create({
    data: { userId, kind: "SINGLE", sampleType: "OUT_OF_SAMPLE", label: "t", config: { symbol: "XAUUSD", timeframe: "H1", fromTs: 0, toTs: 1, initialBalance: 10000, riskPercent: 1, spread: 0.3, slippage: 0.05, commissionPerLot: 3, accountCurrency: "USD" }, summary: {}, report: { stats: {}, trades: [{ secret: "per-trade-row" }] }, tradeCount: 120, dataSource: "Uploaded CSV: x.csv", synthetic: false, ...over },
  });
}

export { saveStrategy, createSyntheticDataset };
