import "server-only";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { loadPlan } from "@/lib/plan";
import { cleanText } from "@/lib/sanitize";
import { PIP_SIZE, presetFor } from "@/lib/engine/instruments";
import { parsePine, validatePineSource, type PineInput } from "./pine";
import { compareVersions, parseStrategyDef, VERSION_RE } from "./schemas";
import { collectParams, runBacktest, validateConfig } from "./backtest";
import { buildReport, statsOf } from "./report";
import { expandGrid, runOptimization, walkForward, type ParamGrid } from "./optimize";
import { generateSyntheticCandles, parseCandleCsv, timeframeFromCandles } from "./candles";
import { parseTradingViewTrades } from "./tv-import";
import type { BacktestConfig, Candle, StrategyDef } from "./types";
import type { Prisma } from "@prisma/client";

export type Result<T> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });

// ------------------------------------------------------------------ plan limits

async function limits(userId: string) {
  return (await loadPlan(userId)).limits.lab;
}

// ------------------------------------------------------------------ indicators

export interface IndicatorInput {
  name: string;
  description: string;
  markets: string[];
  timeframes: string[];
  visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
  kind?: "INDICATOR" | "STRATEGY";
  source: string;
  version?: string;
  changelog?: string;
  compatibility?: string;
  inputs?: PineInput[];
}

const clean = (xs: string[], max = 20) => [...new Set(xs.map((x) => cleanText(x, 20).toUpperCase()).filter(Boolean))].slice(0, max);

export async function createIndicator(userId: string, authorName: string, i: IndicatorInput): Promise<Result<{ id: string }>> {
  const name = cleanText(i.name, 80);
  if (name.length < 2) return fail("Give your indicator a name.");
  const srcErr = validatePineSource(i.source);
  if (srcErr) return fail(srcErr);
  const version = i.version?.trim() || "1.0";
  if (!VERSION_RE.test(version)) return fail("Version must look like 1.0 or 1.2.3.");
  const count = await prisma.indicator.count({ where: { userId } });
  const lim = await limits(userId);
  if (count >= lim.indicators) return fail(`Your plan allows ${lim.indicators} indicators. Upgrade to Pro for more.`);

  const meta = parsePine(i.source);
  const inputs = (i.inputs && i.inputs.length ? i.inputs : meta.inputs).slice(0, 200);
  const ind = await prisma.indicator.create({
    data: {
      userId, name, author: cleanText(authorName, 80), description: cleanText(i.description, 4000),
      kind: i.kind === "STRATEGY" || meta.kind === "strategy" ? "STRATEGY" : "INDICATOR",
      markets: clean(i.markets), timeframes: clean(i.timeframes), visibility: i.visibility, pineVersion: meta.version, latestVersion: version,
      versions: {
        create: {
          version, changelog: cleanText(i.changelog ?? "Initial release", 2000), compatibility: cleanText(i.compatibility ?? (meta.version ? `Pine Script v${meta.version}` : ""), 200),
          pineVersion: meta.version, inputs: inputs as unknown as Prisma.InputJsonValue,
          source: { create: { code: i.source, sha256: createHash("sha256").update(i.source).digest("hex") } },
        },
      },
    },
  });
  return { ok: true, id: ind.id };
}

/** Owner-scoped. Returns metadata + version list WITHOUT source code. */
export async function getOwnedIndicator(userId: string, id: string) {
  return prisma.indicator.findFirst({
    where: { id, userId },
    include: { versions: { orderBy: { releasedAt: "desc" }, select: { id: true, version: true, changelog: true, compatibility: true, pineVersion: true, inputs: true, releasedAt: true } }, listing: { select: { id: true, status: true, slug: true } }, strategies: { select: { id: true, name: true, updatedAt: true } } },
  });
}

/** The ONLY owner path to private source. Ownership is part of the query. */
export async function getOwnedSource(userId: string, versionId: string) {
  return prisma.indicatorSource.findFirst({ where: { versionId, version: { indicator: { userId } } }, select: { code: true, sha256: true, version: { select: { version: true, indicator: { select: { name: true } } } } } });
}

export async function addVersion(userId: string, indicatorId: string, v: { version: string; changelog: string; compatibility: string; source: string; inputs?: PineInput[] }): Promise<Result<{ versionId: string }>> {
  const ind = await prisma.indicator.findFirst({ where: { id: indicatorId, userId } });
  if (!ind) return fail("Indicator not found.");
  if (!VERSION_RE.test(v.version)) return fail("Version must look like 1.1 or 2.0.");
  if (compareVersions(v.version, ind.latestVersion) <= 0) return fail(`The new version must be higher than ${ind.latestVersion}.`);
  const srcErr = validatePineSource(v.source);
  if (srcErr) return fail(srcErr);
  if (!cleanText(v.changelog, 2000)) return fail("Write a short change log so buyers know what changed.");
  const meta = parsePine(v.source);
  const created = await prisma.$transaction(async (tx) => {
    const ver = await tx.indicatorVersion.create({
      data: {
        indicatorId, version: v.version, changelog: cleanText(v.changelog, 2000), compatibility: cleanText(v.compatibility, 200), pineVersion: meta.version,
        inputs: ((v.inputs && v.inputs.length ? v.inputs : meta.inputs).slice(0, 200)) as unknown as Prisma.InputJsonValue,
        source: { create: { code: v.source, sha256: createHash("sha256").update(v.source).digest("hex") } },
      },
    });
    await tx.indicator.update({ where: { id: indicatorId }, data: { latestVersion: v.version, pineVersion: meta.version ?? ind.pineVersion } });
    return ver;
  });
  return { ok: true, versionId: created.id };
}

export async function updateIndicatorMeta(userId: string, id: string, m: { name: string; description: string; markets: string[]; timeframes: string[]; visibility: "PRIVATE" | "UNLISTED" | "PUBLIC" }): Promise<Result<object>> {
  const name = cleanText(m.name, 80);
  if (name.length < 2) return fail("Give your indicator a name.");
  const res = await prisma.indicator.updateMany({ where: { id, userId }, data: { name, description: cleanText(m.description, 4000), markets: clean(m.markets), timeframes: clean(m.timeframes), visibility: m.visibility } });
  return res.count ? { ok: true } : fail("Indicator not found.");
}

export async function deleteIndicator(userId: string, id: string): Promise<Result<object>> {
  const ind = await prisma.indicator.findFirst({ where: { id, userId }, include: { listing: { select: { id: true, _count: { select: { licenses: true } } } } } });
  if (!ind) return fail("Indicator not found.");
  if (ind.listing && ind.listing._count.licenses > 0) return fail("This indicator has buyers, so it can't be deleted. Unpublish it instead.");
  await prisma.indicator.delete({ where: { id } });
  return { ok: true };
}

// ------------------------------------------------------------------ strategies

export async function saveStrategy(userId: string, s: { id?: string; name: string; description?: string; symbol: string; indicatorId?: string | null; definition: unknown }): Promise<Result<{ id: string }>> {
  const name = cleanText(s.name, 100);
  if (name.length < 2) return fail("Give the strategy a name.");
  const parsed = parseStrategyDef(s.definition);
  if (!parsed.ok) return fail(parsed.error);
  if (parsed.def.longEntry.length + parsed.def.shortEntry.length === 0) return fail("Define at least one entry rule. An indicator alone is not a strategy.");
  if (s.indicatorId) {
    const own = await prisma.indicator.findFirst({ where: { id: s.indicatorId, userId }, select: { id: true } });
    if (!own) return fail("Indicator not found.");
  }
  const data = { name, description: cleanText(s.description ?? "", 2000), symbol: cleanText(s.symbol, 20).toUpperCase() || "XAUUSD", indicatorId: s.indicatorId ?? null, definition: parsed.def as unknown as Prisma.InputJsonValue };
  if (s.id) {
    const r = await prisma.strategy.updateMany({ where: { id: s.id, userId }, data });
    return r.count ? { ok: true, id: s.id } : fail("Strategy not found.");
  }
  const lim = await limits(userId);
  if ((await prisma.strategy.count({ where: { userId } })) >= lim.strategies) return fail(`Your plan allows ${lim.strategies} strategies. Upgrade to Pro for more.`);
  const created = await prisma.strategy.create({ data: { userId, ...data } });
  return { ok: true, id: created.id };
}

export async function getOwnedStrategy(userId: string, id: string) {
  return prisma.strategy.findFirst({ where: { id, userId }, include: { indicator: { select: { id: true, name: true } } } });
}

// ------------------------------------------------------------------ datasets

const toCandles = (json: unknown): Candle[] => (json as number[][]).map(([t, o, h, l, c, v]) => ({ t, o, h, l, c, v }));
const fromCandles = (c: Candle[]) => c.map((x) => [x.t, x.o, x.h, x.l, x.c, x.v]);

export async function createDatasetFromCsv(userId: string, o: { name: string; symbol: string; filename: string; text: string; utcOffsetHours: number; timeframe?: string }): Promise<Result<{ id: string; warnings: string[] }>> {
  const lim = await limits(userId);
  if ((await prisma.dataset.count({ where: { userId } })) >= lim.datasets) return fail(`Your plan allows ${lim.datasets} datasets. Upgrade to Pro for more.`);
  const parsed = parseCandleCsv(o.text, o.utcOffsetHours);
  if (parsed.error) return fail(parsed.error);
  const tf = o.timeframe && o.timeframe !== "AUTO" ? o.timeframe : timeframeFromCandles(parsed.candles);
  const c = parsed.candles;
  const ds = await prisma.dataset.create({
    data: { userId, name: cleanText(o.name, 80) || o.filename, symbol: cleanText(o.symbol, 20).toUpperCase(), timeframe: tf, source: "CSV_UPLOAD", originalFilename: cleanText(o.filename, 120), candleCount: c.length, fromTs: new Date(c[0].t), toTs: new Date(c[c.length - 1].t), candles: fromCandles(c) },
  });
  return { ok: true, id: ds.id, warnings: parsed.warnings };
}

export async function createSyntheticDataset(userId: string, o: { symbol: string; timeframe: string; days: number }): Promise<Result<{ id: string }>> {
  const lim = await limits(userId);
  if ((await prisma.dataset.count({ where: { userId } })) >= lim.datasets) return fail(`Your plan allows ${lim.datasets} datasets. Upgrade to Pro for more.`);
  const start: Record<string, number> = { XAUUSD: 2400, BTCUSD: 62000, EURUSD: 1.08, GBPUSD: 1.27, USDJPY: 150, US30: 39000, NAS100: 18000 };
  const c = generateSyntheticCandles({ symbol: o.symbol, timeframe: o.timeframe, days: Math.min(900, Math.max(10, o.days)), startPrice: start[o.symbol] ?? 100, seed: 20260601 });
  const ds = await prisma.dataset.create({
    data: { userId, name: `SYNTHETIC ${o.symbol} ${o.timeframe}`, symbol: o.symbol, timeframe: o.timeframe, source: "SYNTHETIC", candleCount: c.length, fromTs: new Date(c[0].t), toTs: new Date(c[c.length - 1].t), candles: fromCandles(c) },
  });
  return { ok: true, id: ds.id };
}

export async function getOwnedDataset(userId: string, id: string) {
  return prisma.dataset.findFirst({ where: { id, userId } });
}

// ------------------------------------------------------------------ backtests

export interface RunInput {
  strategyId: string;
  datasetId: string;
  fromDate?: string;
  toDate?: string;
  initialBalance: number;
  riskPercent: number;
  spread: number;
  slippage: number;
  commissionPerLot: number;
  pipSize?: number;
  accountCurrency?: string;
  fxRate?: number;
  spec?: Partial<BacktestConfig["spec"]>;
  params?: Record<string, number>;
}

export function buildConfig(ds: { symbol: string; timeframe: string; fromTs: Date; toTs: Date }, i: RunInput): BacktestConfig {
  const preset = presetFor(ds.symbol);
  const spec = { ...(preset ?? { contractSize: 100, tickSize: 0.01, tickValue: 1, minLot: 0.01, maxLot: 100, lotStep: 0.01, quoteCurrency: "USD" }), ...(i.spec ?? {}) };
  const from = i.fromDate ? Date.parse(`${i.fromDate}T00:00:00Z`) : ds.fromTs.getTime();
  const to = i.toDate ? Date.parse(`${i.toDate}T23:59:59Z`) : ds.toTs.getTime();
  return {
    symbol: ds.symbol, timeframe: ds.timeframe,
    fromTs: Math.max(from, ds.fromTs.getTime()), toTs: Math.min(to, ds.toTs.getTime()),
    initialBalance: i.initialBalance, riskPercent: i.riskPercent, spread: i.spread, slippage: i.slippage, commissionPerLot: i.commissionPerLot,
    pipSize: i.pipSize ?? PIP_SIZE[ds.symbol] ?? 0.0001,
    spec: { contractSize: spec.contractSize, tickSize: spec.tickSize, tickValue: spec.tickValue, minLot: spec.minLot, maxLot: spec.maxLot, lotStep: spec.lotStep, quoteCurrency: spec.quoteCurrency },
    fxRate: i.fxRate ?? 1, accountCurrency: i.accountCurrency ?? "USD", params: i.params,
  };
}

async function prepare(userId: string, i: RunInput) {
  const [strategy, ds] = await Promise.all([getOwnedStrategy(userId, i.strategyId), getOwnedDataset(userId, i.datasetId)]);
  if (!strategy) return fail("Strategy not found.");
  if (!ds) return fail("Dataset not found.");
  const parsed = parseStrategyDef(strategy.definition);
  if (!parsed.ok) return fail(parsed.error);
  const params = { ...(parsed.def.defaults ?? {}), ...(i.params ?? {}) };
  const missing = collectParams(parsed.def).filter((p) => !(p in params));
  if (missing.length) return fail(`Give a value for: ${missing.join(", ")}.`);
  const config = buildConfig(ds, { ...i, params });
  const errs = validateConfig(config);
  if (errs.length) return fail(errs[0]);
  return { ok: true as const, strategy, ds, def: parsed.def, config, candles: toCandles(ds.candles) };
}

function dataSourceLabel(ds: { source: string; originalFilename: string | null; fromTs: Date; toTs: Date }) {
  return ds.source === "SYNTHETIC" ? "SYNTHETIC DEMO DATA" : `Uploaded CSV: ${ds.originalFilename ?? "dataset"} (${ds.fromTs.toISOString().slice(0, 10)} → ${ds.toTs.toISOString().slice(0, 10)})`;
}

async function checkStoredLimit(userId: string): Promise<string | null> {
  const lim = await limits(userId);
  const n = await prisma.backtestRun.count({ where: { userId } });
  return n >= lim.backtests ? `Your plan stores up to ${lim.backtests} backtests. Delete some or upgrade to Pro.` : null;
}

export async function runAndSaveBacktest(userId: string, i: RunInput, label = ""): Promise<Result<{ id: string }>> {
  const limitErr = await checkStoredLimit(userId);
  if (limitErr) return fail(limitErr);
  const p = await prepare(userId, i);
  if (!p.ok) return p;
  let result;
  try { result = runBacktest(p.candles, p.def, p.config); } catch (e) { return fail(e instanceof Error ? e.message : "Backtest failed"); }
  const report = buildReport(result.trades, p.config.initialBalance, p.config.symbol);
  const run = await prisma.backtestRun.create({
    data: {
      userId, strategyId: p.strategy.id, datasetId: p.ds.id, kind: "SINGLE", sampleType: "FULL", label: cleanText(label, 100),
      config: p.config as unknown as Prisma.InputJsonValue, params: (p.config.params ?? {}) as Prisma.InputJsonValue,
      summary: report.stats as unknown as Prisma.InputJsonValue,
      report: { ...report, warnings: result.warnings, skipped: result.skipped } as unknown as Prisma.InputJsonValue,
      tradeCount: report.stats.trades, dataSource: dataSourceLabel(p.ds), synthetic: p.ds.source === "SYNTHETIC",
    },
  });
  return { ok: true, id: run.id };
}

export async function runAndSaveOptimization(userId: string, i: RunInput, grid: ParamGrid[]): Promise<Result<{ id: string }>> {
  if (!(await limits(userId)).optimization) return fail("Parameter testing is a Pro feature.");
  const limitErr = await checkStoredLimit(userId);
  if (limitErr) return fail(limitErr);
  const p = await prepare(userId, { ...i, params: i.params ?? {} });
  if (!p.ok) {
    // missing params are expected here: the grid supplies them
    if (!/Give a value for/.test(p.error)) return p;
  }
  const strategy = await getOwnedStrategy(userId, i.strategyId);
  const ds = await getOwnedDataset(userId, i.datasetId);
  if (!strategy || !ds) return fail("Strategy or dataset not found.");
  const parsed = parseStrategyDef(strategy.definition);
  if (!parsed.ok) return fail(parsed.error);
  const def = parsed.def;
  const needed = collectParams(def);
  const covered = new Set([...Object.keys(def.defaults ?? {}), ...grid.filter((g) => g.values.length).map((g) => g.name)]);
  const missing = needed.filter((n) => !covered.has(n));
  if (missing.length) return fail(`Give a value or a range for: ${missing.join(", ")}.`);
  let combos;
  try { combos = expandGrid(grid); } catch (e) { return fail(e instanceof Error ? e.message : "Invalid grid"); }
  const config = buildConfig(ds, { ...i, params: def.defaults ?? {} });
  const errs = validateConfig(config);
  if (errs.length) return fail(errs[0]);
  const rows = runOptimization(toCandles(ds.candles), def, config, grid);
  const run = await prisma.backtestRun.create({
    data: {
      userId, strategyId: strategy.id, datasetId: ds.id, kind: "OPTIMIZATION", sampleType: "FULL", label: `Parameter test (${combos.length} configurations)`,
      config: config as unknown as Prisma.InputJsonValue, summary: { combinations: combos.length } as Prisma.InputJsonValue,
      report: { rows, grid } as unknown as Prisma.InputJsonValue, tradeCount: 0, dataSource: dataSourceLabel(ds), synthetic: ds.source === "SYNTHETIC",
    },
  });
  return { ok: true, id: run.id };
}

export async function runAndSaveWalkForward(userId: string, i: RunInput, splitDate: string): Promise<Result<{ groupId: string; inSampleId: string; outOfSampleId: string }>> {
  if (!(await limits(userId)).optimization) return fail("Walk-forward testing is a Pro feature.");
  const limitErr = await checkStoredLimit(userId);
  if (limitErr) return fail(limitErr);
  const p = await prepare(userId, i);
  if (!p.ok) return p;
  const splitTs = Date.parse(`${splitDate}T00:00:00Z`);
  if (!Number.isFinite(splitTs)) return fail("Pick the date where the out-of-sample period starts.");
  let wf;
  try { wf = walkForward(p.candles, p.def, p.config, splitTs, p.config.params ?? {}); } catch (e) { return fail(e instanceof Error ? e.message : "Walk-forward failed"); }
  const groupId = `wf_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const mk = (part: typeof wf.inSample, sampleType: "IN_SAMPLE" | "OUT_OF_SAMPLE") =>
    prisma.backtestRun.create({
      data: {
        userId, strategyId: p.strategy.id, datasetId: p.ds.id, kind: "WALK_FORWARD", sampleType, groupId, label: sampleType === "IN_SAMPLE" ? "Walk-forward: in-sample" : "Walk-forward: out-of-sample",
        config: { ...p.config, fromTs: part.fromTs, toTs: part.toTs } as unknown as Prisma.InputJsonValue, params: (p.config.params ?? {}) as Prisma.InputJsonValue,
        summary: part.report.stats as unknown as Prisma.InputJsonValue, report: part.report as unknown as Prisma.InputJsonValue,
        tradeCount: part.report.stats.trades, dataSource: dataSourceLabel(p.ds), synthetic: p.ds.source === "SYNTHETIC",
      },
    });
  const [a, b] = await Promise.all([mk(wf.inSample, "IN_SAMPLE"), mk(wf.outOfSample, "OUT_OF_SAMPLE")]);
  return { ok: true, groupId, inSampleId: a.id, outOfSampleId: b.id };
}

export async function importTradingViewResults(userId: string, o: { strategyId?: string; name: string; text: string; initialBalance: number; assumedRiskPercent: number; utcOffsetHours: number; symbol: string; timeframe: string }): Promise<Result<{ id: string }>> {
  const limitErr = await checkStoredLimit(userId);
  if (limitErr) return fail(limitErr);
  if (o.text.length > 3 * 1024 * 1024) return fail("File is larger than 3 MB.");
  const r = parseTradingViewTrades(o.text, { initialBalance: o.initialBalance, assumedRiskPercent: o.assumedRiskPercent, utcOffsetHours: o.utcOffsetHours });
  if (r.error) return fail(r.error);
  if (o.strategyId && !(await getOwnedStrategy(userId, o.strategyId))) return fail("Strategy not found.");
  const report = buildReport(r.trades, o.initialBalance, o.symbol);
  const first = r.trades[0].entryTime, last = r.trades[r.trades.length - 1].exitTime;
  const config = { symbol: o.symbol, timeframe: o.timeframe, fromTs: first, toTs: last, initialBalance: o.initialBalance, riskPercent: o.assumedRiskPercent, spread: 0, slippage: 0, commissionPerLot: 0, pipSize: 0, spec: { contractSize: 0, tickSize: 0, tickValue: 0, minLot: 0, maxLot: 0, lotStep: 0, quoteCurrency: "" }, fxRate: 1, accountCurrency: "USD" };
  const run = await prisma.backtestRun.create({
    data: {
      userId, strategyId: o.strategyId ?? null, kind: "IMPORTED", sampleType: "FULL", label: cleanText(o.name, 100) || "Imported TradingView results",
      config: config as unknown as Prisma.InputJsonValue, summary: report.stats as unknown as Prisma.InputJsonValue, report: { ...report, skipped: { imported: r.skipped } } as unknown as Prisma.InputJsonValue,
      tradeCount: report.stats.trades, dataSource: "Imported TradingView trade list (not verified by RiskPilot)", synthetic: false,
    },
  });
  return { ok: true, id: run.id };
}

export async function getOwnedRun(userId: string, id: string) {
  return prisma.backtestRun.findFirst({ where: { id, userId }, include: { strategy: { select: { id: true, name: true } } } });
}

export async function deleteRun(userId: string, id: string) {
  await prisma.backtestRun.deleteMany({ where: { id, userId } });
}

export { statsOf };
export type { StrategyDef };
