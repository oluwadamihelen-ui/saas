import "server-only";
import { prisma } from "@/lib/db";
import { canAccessVersion, isLicenseActive } from "./licensing";
import { assertAdmin, audit, type Actor } from "./admin-core";
import { getOwnedDataset, buildConfig, type RunInput } from "@/lib/lab/service";
import { runBacktest, validateConfig, collectParams } from "@/lib/lab/backtest";
import { buildReport } from "@/lib/lab/report";
import { parseStrategyDef } from "@/lib/lab/schemas";
import type { Candle } from "@/lib/lab/types";
import type { Prisma } from "@prisma/client";

export type SourceResult =
  | { ok: true; code: string; version: string; filename: string; asOwner: boolean }
  | { ok: false; status: 401 | 403 | 404; reason: string };

/**
 * The single gate for reading another person's Pine source.
 *  • The creator can always read their own.
 *  • A buyer can read it ONLY if the creator chose "Source code included", the listing is live,
 *    the license is active, and the version is covered by the product's update policy.
 *  • Everyone else gets nothing. Protected (default) products never expose source to buyers.
 */
export async function getSourceForUser(userId: string | null, listingId: string): Promise<SourceResult> {
  if (!userId) return { ok: false, status: 401, reason: "Sign in first." };
  const l = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, status: true, sourceIncluded: true, updatePolicy: true, creator: { select: { userId: true, status: true } }, indicator: { select: { name: true, versions: { orderBy: { releasedAt: "desc" }, select: { id: true, version: true, releasedAt: true, source: { select: { code: true } } } } } } },
  });
  if (!l) return { ok: false, status: 404, reason: "Not found." };

  if (l.creator.userId === userId) {
    const v = l.indicator.versions.find((x) => x.source);
    return v?.source ? { ok: true, code: v.source.code, version: v.version, filename: `${slug(l.indicator.name)}-v${v.version}.pine`, asOwner: true } : { ok: false, status: 404, reason: "No source." };
  }
  const license = await prisma.license.findUnique({ where: { userId_listingId: { userId, listingId } } });
  if (!license || !isLicenseActive(license, new Date())) return { ok: false, status: 403, reason: "You don't have access to this product." };
  if (l.status !== "APPROVED") return { ok: false, status: 403, reason: "This product is not currently available." };
  if (!l.sourceIncluded) return { ok: false, status: 403, reason: "The creator has not included source code with this product." };
  const now = new Date();
  const v = l.indicator.versions.find((x) => x.source && canAccessVersion(license, l.updatePolicy, x, now));
  if (!v?.source) return { ok: false, status: 403, reason: "No version is available under your license." };
  return { ok: true, code: v.source.code, version: v.version, filename: `${slug(l.indicator.name)}-v${v.version}.pine`, asOwner: false };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "indicator";

/** Admin review may need to read source (e.g. malicious code). Every read is audited. */
export async function getSourceForAdminReview(actor: Actor, listingId: string): Promise<{ code: string; version: string } | null> {
  assertAdmin(actor);
  const l = await prisma.listing.findUnique({ where: { id: listingId }, select: { indicator: { select: { versions: { orderBy: { releasedAt: "desc" }, take: 1, select: { version: true, source: { select: { code: true } } } } } } } });
  const v = l?.indicator.versions[0];
  if (!v?.source) return null;
  await audit(actor, "VIEW_SOURCE", "listing", listingId, { version: v.version });
  return { code: v.source.code, version: v.version };
}

/** The versions a buyer is entitled to (metadata only — never the source). */
export async function entitledVersions(userId: string, listingId: string) {
  const l = await prisma.listing.findUnique({ where: { id: listingId }, select: { updatePolicy: true, indicator: { select: { versions: { orderBy: { releasedAt: "desc" }, select: { id: true, version: true, changelog: true, compatibility: true, releasedAt: true } } } } } });
  const license = await prisma.license.findUnique({ where: { userId_listingId: { userId, listingId } } });
  if (!l || !license) return [];
  const now = new Date();
  return l.indicator.versions.filter((v) => canAccessVersion(license, l.updatePolicy, v, now));
}

export type LicensedRun = { ok: true; runId: string } | { ok: false; error: string };

/**
 * Runs the creator's PUBLISHED strategy for a licensed buyer on the buyer's own data.
 * The strategy rules are used server-side only — the buyer receives results, never the definition.
 */
export async function runLicensedBacktest(userId: string, listingId: string, i: Omit<RunInput, "strategyId">): Promise<LicensedRun> {
  const l = await prisma.listing.findUnique({ where: { id: listingId }, select: { id: true, status: true, allowBuyerBacktest: true, strategyId: true, title: true } });
  if (!l || l.status !== "APPROVED" || !l.allowBuyerBacktest || !l.strategyId) return { ok: false, error: "Testing isn't available for this product." };
  const license = await prisma.license.findUnique({ where: { userId_listingId: { userId, listingId } } });
  if (!license || !isLicenseActive(license, new Date())) return { ok: false, error: "You don't have access to this product." };
  const [strategy, ds] = await Promise.all([prisma.strategy.findUnique({ where: { id: l.strategyId }, select: { definition: true } }), getOwnedDataset(userId, i.datasetId)]);
  if (!strategy) return { ok: false, error: "Testing isn't available for this product." };
  if (!ds) return { ok: false, error: "Dataset not found." };
  const parsed = parseStrategyDef(strategy.definition);
  if (!parsed.ok) return { ok: false, error: "Testing isn't available for this product." };
  const params = { ...(parsed.def.defaults ?? {}) };
  if (collectParams(parsed.def).some((p) => !(p in params))) return { ok: false, error: "Testing isn't available for this product." };
  const config = buildConfig(ds, { ...i, strategyId: l.strategyId, params });
  const errs = validateConfig(config);
  if (errs.length) return { ok: false, error: errs[0] };
  const candles = (ds.candles as number[][]).map(([t, o, h, lo, c, v]): Candle => ({ t, o, h, l: lo, c, v }));
  let result;
  try { result = runBacktest(candles, parsed.def, config); } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Backtest failed" }; }
  const report = buildReport(result.trades, config.initialBalance, config.symbol);
  const run = await prisma.backtestRun.create({
    data: {
      userId, strategyId: null, datasetId: ds.id, kind: "SINGLE", sampleType: "FULL", label: `Licensed test: ${l.title}`,
      // The config shown to the buyer deliberately omits the strategy's parameter values.
      config: { ...config, params: undefined } as unknown as Prisma.InputJsonValue, summary: report.stats as unknown as Prisma.InputJsonValue,
      report: { ...report, warnings: result.warnings } as unknown as Prisma.InputJsonValue, tradeCount: report.stats.trades,
      dataSource: ds.source === "SYNTHETIC" ? "SYNTHETIC DEMO DATA" : `Uploaded CSV: ${ds.originalFilename ?? "dataset"}`, synthetic: ds.source === "SYNTHETIC",
    },
  });
  return { ok: true, runId: run.id };
}

/** Buyer's library. Metadata only. */
export async function buyerLibrary(userId: string) {
  const licenses = await prisma.license.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, status: true, type: true, startedAt: true, currentPeriodEnd: true, tradingViewUsername: true, accessGrantedAt: true, maxMajor: true,
      listing: { select: { id: true, slug: true, title: true, status: true, sourceIncluded: true, allowBuyerBacktest: true, tradingViewAccess: true, updatePolicy: true, documentation: true, indicator: { select: { latestVersion: true } }, creator: { select: { displayName: true } } } },
    },
  });
  const now = new Date();
  return licenses.map((l) => ({ ...l, active: isLicenseActive(l, now) }));
}
