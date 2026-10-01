import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { addVersion, createIndicator, createSyntheticDataset, deleteIndicator, getOwnedIndicator, getOwnedRun, getOwnedSource, getOwnedStrategy, importTradingViewResults, runAndSaveBacktest, runAndSaveOptimization, runAndSaveWalkForward, saveStrategy, updateIndicatorMeta } from "@/lib/lab/service";
import { runLicensedBacktest } from "@/lib/market/access";
import { fulfillOrder, startPurchase } from "@/lib/market/orders";
import { attachEvidence, updateListing } from "@/lib/market/listings";
import { cleanup, hasDb, makeUser } from "./helpers";
import { PINE, SECRET, baseListing, makeListing } from "./market-helpers";
import type { StrategyDef } from "@/lib/lab/types";

const users: string[] = [];
const track = <T extends { id: string }>(u: T) => (users.push(u.id), u);
afterAll(() => cleanup(users));
beforeEach(() => { process.env.PAYMENT_PROVIDER = "mock"; });

async function proUser() {
  const u = track(await makeUser());
  await prisma.subscription.create({ data: { userId: u.id, plan: "PRO", interval: "MONTHLY", provider: "mock", currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000) } });
  return u;
}

const def = (over: Partial<StrategyDef> = {}): StrategyDef => ({
  direction: "both",
  longEntry: [{ l: { k: "ind", name: "ema", period: { param: "fast" } }, op: "crosses_above", r: { k: "ind", name: "ema", period: { param: "slow" } } }],
  shortEntry: [{ l: { k: "ind", name: "ema", period: { param: "fast" } }, op: "crosses_below", r: { k: "ind", name: "ema", period: { param: "slow" } } }],
  longExit: [], shortExit: [], exitOnOpposite: true, maxBarsInTrade: null,
  stop: { type: "atr", value: 1.5 }, target: { type: "rr", value: 2 }, sessions: null, defaults: { fast: 20, slow: 50 }, ...over,
});

const ind = (name = "Gold Sniper V1") => ({ name, description: "d", markets: ["XAUUSD"], timeframes: ["M15", "H1", "H4"], visibility: "PRIVATE" as const, source: PINE });
const run = (strategyId: string, datasetId: string) => ({ strategyId, datasetId, initialBalance: 10_000, riskPercent: 1, spread: 0.3, slippage: 0.05, commissionPerLot: 3 });

describe.skipIf(!hasDb)("indicators: metadata vs private source", () => {
  it("stores metadata and source separately, parses inputs, and records version/Pine version", async () => {
    const u = track(await makeUser());
    const r = await createIndicator(u.id, "Ada", ind());
    if (!r.ok) throw new Error(r.error);
    const i = await getOwnedIndicator(u.id, r.id);
    expect(i).toMatchObject({ name: "Gold Sniper V1", author: "Ada", visibility: "PRIVATE", pineVersion: 5, latestVersion: "1.0", markets: ["XAUUSD"], timeframes: ["M15", "H1", "H4"] });
    expect(i!.versions[0].inputs).toEqual([expect.objectContaining({ name: "len", type: "int", defval: 20, min: 1 })]);
    expect(JSON.stringify(i)).not.toContain(SECRET); // metadata query never carries source
    const src = await getOwnedSource(u.id, i!.versions[0].id);
    expect(src?.code).toContain(SECRET);
  });

  it("nobody else can read, edit, version or delete it", async () => {
    const owner = track(await makeUser()), other = track(await makeUser());
    const r = await createIndicator(owner.id, "Ada", ind());
    if (!r.ok) throw new Error(r.error);
    const v = (await getOwnedIndicator(owner.id, r.id))!.versions[0];
    expect(await getOwnedIndicator(other.id, r.id)).toBeNull();
    expect(await getOwnedSource(other.id, v.id)).toBeNull();
    expect((await addVersion(other.id, r.id, { version: "1.1", changelog: "x", compatibility: "", source: PINE })).ok).toBe(false);
    expect((await updateIndicatorMeta(other.id, r.id, { name: "Hijack", description: "", markets: [], timeframes: [], visibility: "PUBLIC" })).ok).toBe(false);
    expect((await deleteIndicator(other.id, r.id)).ok).toBe(false);
    expect((await getOwnedIndicator(owner.id, r.id))!.name).toBe("Gold Sniper V1");
  });

  it("versions must increase, carry a change log, and update the latest version", async () => {
    const u = track(await makeUser());
    const r = await createIndicator(u.id, "Ada", ind());
    if (!r.ok) throw new Error(r.error);
    expect((await addVersion(u.id, r.id, { version: "1.0", changelog: "dup", compatibility: "", source: PINE })).ok).toBe(false);
    expect((await addVersion(u.id, r.id, { version: "0.9", changelog: "older", compatibility: "", source: PINE })).ok).toBe(false);
    expect((await addVersion(u.id, r.id, { version: "1.1", changelog: "", compatibility: "", source: PINE })).ok).toBe(false);
    expect((await addVersion(u.id, r.id, { version: "v2", changelog: "x", compatibility: "", source: PINE })).ok).toBe(false);
    expect((await addVersion(u.id, r.id, { version: "1.10", changelog: "- Added session filter\n- Fixed calculation issue", compatibility: "Pine v5", source: PINE })).ok).toBe(true);
    expect((await addVersion(u.id, r.id, { version: "1.9", changelog: "lower than 1.10", compatibility: "", source: PINE })).ok).toBe(false); // numeric compare
    expect((await getOwnedIndicator(u.id, r.id))!.latestVersion).toBe("1.10");
  });

  it("validates input, and the Free plan caps indicators", async () => {
    const u = track(await makeUser());
    expect((await createIndicator(u.id, "A", { ...ind(), name: "x" })).ok).toBe(false);
    expect((await createIndicator(u.id, "A", { ...ind(), source: "" })).ok).toBe(false);
    expect((await createIndicator(u.id, "A", { ...ind(), source: "x".repeat(300_000) })).ok).toBe(false);
    expect((await createIndicator(u.id, "A", ind("One"))).ok).toBe(true);
    expect((await createIndicator(u.id, "A", ind("Two"))).ok).toBe(true);
    const third = await createIndicator(u.id, "A", ind("Three"));
    expect(third.ok).toBe(false);
    expect(!third.ok && third.error).toMatch(/Upgrade/);
  });

  it("an indicator with buyers cannot be deleted", async () => {
    const l = await makeListing({ pricing: "FREE" }); track(l.user);
    const b = track(await makeUser());
    await startPurchase({ buyerId: b.id, buyerEmail: "a@b.c", listingId: l.listing.id, currency: "USD", appUrl: "http://x" });
    expect((await deleteIndicator(l.user.id, l.indicatorId)).ok).toBe(false);
  });
});

describe.skipIf(!hasDb)("strategies are separate from indicators", () => {
  it("rejects a strategy with no entry rule, and rejects malformed definitions", async () => {
    const u = track(await makeUser());
    const r = await createIndicator(u.id, "A", ind());
    if (!r.ok) throw new Error(r.error);
    const none = await saveStrategy(u.id, { name: "Gold Sniper + 1% Risk", symbol: "XAUUSD", indicatorId: r.id, definition: def({ longEntry: [], shortEntry: [] }) });
    expect(none.ok).toBe(false);
    expect(!none.ok && none.error).toMatch(/indicator alone is not a strategy/i);
    expect((await saveStrategy(u.id, { name: "Bad", symbol: "XAUUSD", definition: { direction: "sideways" } })).ok).toBe(false);
    expect((await saveStrategy(u.id, { name: "Bad2", symbol: "XAUUSD", definition: def({ stop: { type: "pips", value: { param: "bad name!" } } }) })).ok).toBe(false);
    const ok = await saveStrategy(u.id, { name: "Gold Sniper + 1% Risk", symbol: "XAUUSD", indicatorId: r.id, definition: def() });
    expect(ok.ok).toBe(true);
  });
  it("can't be linked to, or read from, someone else's indicator/strategy", async () => {
    const a = track(await makeUser()), b = track(await makeUser());
    const r = await createIndicator(a.id, "A", ind());
    if (!r.ok) throw new Error(r.error);
    expect((await saveStrategy(b.id, { name: "Mine", symbol: "XAUUSD", indicatorId: r.id, definition: def() })).ok).toBe(false);
    const s = await saveStrategy(a.id, { name: "Theirs", symbol: "XAUUSD", indicatorId: r.id, definition: def() });
    if (!s.ok) throw new Error(s.error);
    expect(await getOwnedStrategy(b.id, s.id)).toBeNull();
    expect((await saveStrategy(b.id, { id: s.id, name: "Hijack", symbol: "XAUUSD", definition: def() })).ok).toBe(false);
    expect((await getOwnedStrategy(a.id, s.id))!.name).toBe("Theirs");
  });
});

describe.skipIf(!hasDb)("backtests, parameter tests and walk-forward", () => {
  it("runs, stores every assumption, labels synthetic data, and isolates results per user", async () => {
    const u = await proUser();
    const other = track(await makeUser());
    const ds = await createSyntheticDataset(u.id, { symbol: "XAUUSD", timeframe: "H1", days: 150 });
    if (!ds.ok) throw new Error(ds.error);
    const s = await saveStrategy(u.id, { name: "Strat", symbol: "XAUUSD", definition: def() });
    if (!s.ok) throw new Error(s.error);
    const r = await runAndSaveBacktest(u.id, run(s.id, ds.id));
    if (!r.ok) throw new Error(r.error);
    const saved = await getOwnedRun(u.id, r.id);
    expect(saved).toMatchObject({ kind: "SINGLE", sampleType: "FULL", synthetic: true, dataSource: "SYNTHETIC DEMO DATA" });
    expect(saved!.config).toMatchObject({ symbol: "XAUUSD", timeframe: "H1", initialBalance: 10_000, riskPercent: 1, spread: 0.3, slippage: 0.05, commissionPerLot: 3 });
    expect(saved!.tradeCount).toBeGreaterThan(0);
    expect(await getOwnedRun(other.id, r.id)).toBeNull();
    // another user can't run against my strategy or dataset
    expect((await runAndSaveBacktest(other.id, run(s.id, ds.id))).ok).toBe(false);
    const otherDs = await createSyntheticDataset(other.id, { symbol: "XAUUSD", timeframe: "H1", days: 60 });
    if (!otherDs.ok) throw new Error(otherDs.error);
    expect((await runAndSaveBacktest(other.id, run(s.id, otherDs.id))).ok).toBe(false);
    expect((await runAndSaveBacktest(u.id, run(s.id, otherDs.id))).ok).toBe(false);
  });

  it("reports missing parameters and bad settings clearly", async () => {
    const u = await proUser();
    const ds = await createSyntheticDataset(u.id, { symbol: "XAUUSD", timeframe: "H1", days: 60 });
    if (!ds.ok) throw new Error(ds.error);
    const s = await saveStrategy(u.id, { name: "Strat", symbol: "XAUUSD", definition: def({ defaults: {} }) });
    if (!s.ok) throw new Error(s.error);
    const miss = await runAndSaveBacktest(u.id, run(s.id, ds.id));
    expect(!miss.ok && miss.error).toMatch(/fast, slow/);
    const s2 = await saveStrategy(u.id, { name: "Strat 2", symbol: "XAUUSD", definition: def() });
    if (!s2.ok) throw new Error(s2.error);
    expect((await runAndSaveBacktest(u.id, { ...run(s2.id, ds.id), riskPercent: 500 })).ok).toBe(false);
    expect((await runAndSaveBacktest(u.id, { ...run(s2.id, ds.id), initialBalance: 0 })).ok).toBe(false);
  });

  it("parameter testing and walk-forward are Pro features; Pro results are unranked, in/out of sample are stored separately", async () => {
    const free = track(await makeUser());
    const fds = await createSyntheticDataset(free.id, { symbol: "XAUUSD", timeframe: "H1", days: 60 });
    const fs = await saveStrategy(free.id, { name: "Strat", symbol: "XAUUSD", definition: def() });
    if (!fds.ok || !fs.ok) throw new Error("setup");
    expect((await runAndSaveOptimization(free.id, run(fs.id, fds.id), [{ name: "fast", values: [10, 20] }])).ok).toBe(false);
    expect((await runAndSaveWalkForward(free.id, run(fs.id, fds.id), "2026-04-01")).ok).toBe(false);

    const u = await proUser();
    const ds = await createSyntheticDataset(u.id, { symbol: "XAUUSD", timeframe: "H1", days: 200 });
    const s = await saveStrategy(u.id, { name: "Strat", symbol: "XAUUSD", definition: def({ defaults: { slow: 50 } }) });
    if (!ds.ok || !s.ok) throw new Error("setup");
    const opt = await runAndSaveOptimization(u.id, run(s.id, ds.id), [{ name: "fast", values: [10, 20, 30] }]);
    if (!opt.ok) throw new Error(opt.error);
    const saved = await getOwnedRun(u.id, opt.id);
    expect(saved!.kind).toBe("OPTIMIZATION");
    const rows = (saved!.report as { rows: { params: { fast: number } }[] }).rows;
    expect(rows.map((r) => r.params.fast)).toEqual([10, 20, 30]); // input order, not performance order
    expect(JSON.stringify(saved!.report)).not.toMatch(/best|rank|optimal/i);
    expect((await runAndSaveOptimization(u.id, run(s.id, ds.id), [{ name: "slow", values: [] }])).ok).toBe(false);

    const dsRow = await prisma.dataset.findUniqueOrThrow({ where: { id: ds.id } });
    const mid = new Date((dsRow.fromTs.getTime() + dsRow.toTs.getTime()) / 2).toISOString().slice(0, 10);
    const wf = await runAndSaveWalkForward(u.id, { ...run(s.id, ds.id), params: { fast: 20 } }, mid);
    if (!wf.ok) throw new Error(wf.error);
    const [a, b] = await Promise.all([getOwnedRun(u.id, wf.inSampleId), getOwnedRun(u.id, wf.outOfSampleId)]);
    expect(a).toMatchObject({ sampleType: "IN_SAMPLE", groupId: wf.groupId, kind: "WALK_FORWARD" });
    expect(b).toMatchObject({ sampleType: "OUT_OF_SAMPLE", groupId: wf.groupId });
    expect(new Date((a!.config as { toTs: number }).toTs).getTime()).toBeLessThan(new Date((b!.config as { fromTs: number }).fromTs).getTime());
  });

  it("imports TradingView results as unverified, and they can never become marketplace evidence", async () => {
    const u = await proUser();
    const csv = ["Trade #,Type,Signal,Date/Time,Price USD,Contracts,Profit USD", "1,Entry long,L,2026-01-06 10:00,2625,1,", "1,Exit long,C,2026-01-06 16:00,2640,1,150"].join("\n");
    const r = await importTradingViewResults(u.id, { name: "TV export", text: csv, initialBalance: 10_000, assumedRiskPercent: 1, utcOffsetHours: 0, symbol: "XAUUSD", timeframe: "H1" });
    if (!r.ok) throw new Error(r.error);
    const saved = await getOwnedRun(u.id, r.id);
    expect(saved).toMatchObject({ kind: "IMPORTED", dataSource: expect.stringContaining("not verified") });
    const l = await makeListing({ approve: false }); track(l.user);
    const imported = await prisma.backtestRun.update({ where: { id: r.id }, data: { userId: l.user.id } });
    expect((await attachEvidence(l.user.id, l.listing.id, imported.id, "")).ok).toBe(false);
  });
});

describe.skipIf(!hasDb)("buyers can test a licensed strategy without ever seeing its rules", () => {
  it("needs a license + the creator's opt-in, uses the buyer's own data, and returns results only", async () => {
    const l = await makeListing({ pricing: "FREE" }); track(l.user);
    await prisma.subscription.create({ data: { userId: l.user.id, plan: "PRO", interval: "MONTHLY", provider: "mock", currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000) } });
    const strat = await saveStrategy(l.user.id, { name: "Secret Sauce", symbol: "XAUUSD", indicatorId: l.indicatorId, definition: def({ defaults: { fast: 13, slow: 37 } }) });
    if (!strat.ok) throw new Error(strat.error);
    const buyer = await proUser();
    const bds = await createSyntheticDataset(buyer.id, { symbol: "XAUUSD", timeframe: "H1", days: 150 });
    if (!bds.ok) throw new Error(bds.error);
    const input = { datasetId: bds.id, initialBalance: 10_000, riskPercent: 1, spread: 0.3, slippage: 0.05, commissionPerLot: 3 };

    expect((await runLicensedBacktest(buyer.id, l.listing.id, input)).ok).toBe(false); // no opt-in, no license
    expect((await updateListing(l.user.id, l.listing.id, baseListing({ pricingModel: "FREE", priceUsd: 0, allowBuyerBacktest: true, strategyId: strat.id }))).ok).toBe(true);
    expect((await runLicensedBacktest(buyer.id, l.listing.id, input)).ok).toBe(false); // opted in, but buyer has no license
    await startPurchase({ buyerId: buyer.id, buyerEmail: "a@b.c", listingId: l.listing.id, currency: "USD", appUrl: "http://x" });
    const r = await runLicensedBacktest(buyer.id, l.listing.id, input);
    if (!r.ok) throw new Error(r.error);
    const saved = await getOwnedRun(buyer.id, r.runId);
    expect(saved!.tradeCount).toBeGreaterThan(0);
    const payload = JSON.stringify(saved);
    expect(payload).not.toContain("Secret Sauce");
    expect(payload).not.toMatch(/"fast"|"slow"|"params":\{/); // rule parameters are not disclosed
    expect(payload).not.toContain(String(strat.id));
    // the creator's dataset can't be borrowed, and strangers can't use the license
    const stranger = track(await makeUser());
    expect((await runLicensedBacktest(stranger.id, l.listing.id, input)).ok).toBe(false);
    const sds = await createSyntheticDataset(stranger.id, { symbol: "XAUUSD", timeframe: "H1", days: 60 });
    if (sds.ok) expect((await runLicensedBacktest(buyer.id, l.listing.id, { ...input, datasetId: sds.id })).ok).toBe(false);
    // refund/revoke ends testing
    await prisma.license.updateMany({ where: { userId: buyer.id, listingId: l.listing.id }, data: { status: "REVOKED" } });
    expect((await runLicensedBacktest(buyer.id, l.listing.id, input)).ok).toBe(false);
    void fulfillOrder;
  });
});
