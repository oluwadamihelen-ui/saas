import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_CHECKLIST } from "../src/lib/engine/guardrail";
import { dayKey } from "../src/lib/engine/time";
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from "../src/lib/market/settings-defaults";
import { splitSale } from "../src/lib/market/fees";
import { generateSyntheticCandles } from "../src/lib/lab/candles";
import { runBacktest } from "../src/lib/lab/backtest";
import { buildReport } from "../src/lib/lab/report";
import { runOptimization, walkForward } from "../src/lib/lab/optimize";
import { parsePine } from "../src/lib/lab/pine";
import { presetFor } from "../src/lib/engine/instruments";
import type { BacktestConfig, StrategyDef } from "../src/lib/lab/types";

const prisma = new PrismaClient();

// Deterministic PRNG so the demo data is the same every run.
let seed = 20260901;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];

const INSTR = [
  { s: "XAUUSD", base: 2650, stop: 8, perLotPerPoint: 100 },
  { s: "BTCUSD", base: 62000, stop: 450, perLotPerPoint: 1 },
  { s: "EURUSD", base: 1.085, stop: 0.0018, perLotPerPoint: 100000 },
  { s: "GBPUSD", base: 1.27, stop: 0.002, perLotPerPoint: 100000 },
];
const SETUPS = ["Breakout", "Pullback", "Range", "Trend continuation", "Reversal"];
const EMO = ["Calm", "Confident", "Focused", "Anxious", "Excited", "Frustrated", "Greedy"];

async function main() {
  const email = "demo@riskpilot.app";
  await prisma.user.deleteMany({ where: { email } });
  const user = await prisma.user.create({ data: { email, name: "Demo Trader", passwordHash: await bcrypt.hash("Passw0rd!", 12), onboardedAt: new Date() } });
  await prisma.checklist.create({ data: { userId: user.id, items: DEFAULT_CHECKLIST } });
  await prisma.subscription.create({ data: { userId: user.id, plan: "PRO", interval: "ANNUAL", provider: "mock", currentPeriodEnd: new Date(Date.now() + 300 * 86_400_000) } });

  const accounts: { name: string; currency: string; balance: number; broker: string; platform: string; n: number; prop?: boolean }[] = [
    { name: "Exness Demo", currency: "USD", balance: 1000, broker: "Exness", platform: "MT5", n: 70 },
    { name: "Prop Challenge (demo)", currency: "USD", balance: 10000, broker: "Demo prop firm", platform: "MT5", n: 28, prop: true },
  ];
  let activeId = "";
  for (const a of accounts) {
    const acc = await prisma.account.create({
      data: { userId: user.id, name: a.name, currency: a.currency, startingBalance: a.balance, broker: a.broker, platform: a.platform, instruments: ["XAUUSD", "BTCUSD", "EURUSD", "GBPUSD"],
        riskSettings: { create: a.prop
          ? { defaultRiskPercent: 0.5, maxRiskPerTrade: 1, maxDailyLossPercent: 5, maxWeeklyLossPercent: 8, maxTradesPerDay: 5, ruleTemplate: "two_step", maxTotalDrawdownPercent: 10, drawdownType: "STATIC", profitTargetPercent: 10 }
          : { defaultRiskPercent: 1, maxRiskPerTrade: 1, maxDailyLossPercent: 3, maxWeeklyLossPercent: 6, maxTradesPerDay: 5 } } },
    });
    if (!activeId) activeId = acc.id;
    let balance = a.balance;
    const now = new Date();
    const rows: Parameters<typeof prisma.trade.create>[0]["data"][] = [];
    for (let i = 0; i < a.n; i++) {
      // Spread over ~80 days; the last few land on "today" (UTC+1) so the dashboard guardrail has data.
      const daysAgo = i >= a.n - 3 ? 0 : Math.floor(((a.n - 3 - i) / (a.n - 3)) * 80);
      const when = new Date(now.getTime() - daysAgo * 86_400_000 - Math.floor(rnd() * 6) * 3_600_000 - (i >= a.n - 3 ? (a.n - i) * 3_600_000 : 0));
      if (when.getUTCDay() === 0 || when.getUTCDay() === 6) when.setUTCDate(when.getUTCDate() - (when.getUTCDay() === 0 ? 2 : 1));
      const inst = pick(INSTR);
      const dir = rnd() > 0.45 ? "LONG" : "SHORT";
      // Realistic imperfection: after a loss, sometimes risk a bit more.
      const prevLoss = rows.length > 0 && (rows[rows.length - 1].result === "LOSS");
      const riskPct = prevLoss && rnd() > 0.65 ? pick([2, 2.5, 3]) : pick([0.5, 1, 1, 1, 1.5]);
      const riskAmount = +(balance * riskPct / 100).toFixed(2);
      const win = rnd() < 0.46;
      const rMult = win ? +(0.8 + rnd() * 2.2).toFixed(2) : +(-(0.9 + rnd() * 0.3)).toFixed(2);
      const pnl = +(riskAmount * rMult).toFixed(2);
      const dist = inst.stop * (0.8 + rnd() * 0.5);
      const entry = +(inst.base * (1 + (rnd() - 0.5) * 0.04)).toFixed(inst.base < 10 ? 5 : 2);
      const stop = +(dir === "LONG" ? entry - dist : entry + dist).toFixed(inst.base < 10 ? 5 : 2);
      const tp = +(dir === "LONG" ? entry + dist * 2 : entry - dist * 2).toFixed(inst.base < 10 ? 5 : 2);
      const lots = +(riskAmount / (Math.abs(entry - stop) * inst.perLotPerPoint / (a.currency === "NGN" ? 1 / 1500 : 1))).toFixed(2);
      const hour = when.getUTCHours();
      const result = pnl > 0 ? "WIN" : pnl < 0 ? "LOSS" : "BREAKEVEN";
      rows.push({
        userId: user.id, accountId: acc.id, openedAt: when, instrument: inst.s, direction: dir, entryPrice: entry, stopLoss: stop, takeProfit: tp,
        exitPrice: result === "WIN" ? tp : stop, lots: Math.max(lots, 0.01), riskPercent: riskPct, riskAmount, result, pnl, rMultiple: rMult,
        setup: pick(SETUPS), session: hour >= 13 ? "New York" : hour >= 7 ? "London" : "Asia",
        reasonEntry: "Demo trade — fictional data", reasonExit: win ? "Target reached" : "Stopped out",
        emotionBefore: pick(EMO), emotionAfter: win ? pick(["Calm", "Confident", "Excited"]) : pick(["Frustrated", "Calm", "Anxious"]),
        checklistScore: rnd() > 0.3 ? pick([50, 63, 75, 88, 100]) : null,
      });
      balance += pnl;
    }
    rows.sort((x, y) => (x.openedAt as Date).getTime() - (y.openedAt as Date).getTime());
    for (const r of rows) await prisma.trade.create({ data: r });

    const byDay = new Map<string, { c: number; r: number; p: number }>();
    for (const r of rows) { const k = dayKey(r.openedAt as Date); const d = byDay.get(k) ?? { c: 0, r: 0, p: 0 }; d.c++; d.r += r.riskAmount as number; d.p += r.pnl as number; byDay.set(k, d); }
    for (const [day, d] of byDay) await prisma.dailyRisk.create({ data: { userId: user.id, accountId: acc.id, day, tradeCount: d.c, riskUsed: d.r, pnl: d.p, limitHit: -d.p >= (a.balance * 3) / 100 } });
    // Calculation history sample
    if (a.n) await prisma.positionCalculation.create({ data: { userId: user.id, accountId: acc.id, instrument: "XAUUSD", entryPrice: 2650, stopLoss: 2640, takeProfit: 2680, balance: 1000, riskPercent: 1, riskAmount: 10, lots: 0.01, lossPerLot: 1000, specConfirmed: false, inputs: { fx: 1, entry: "2650", stop: "2640", tp: "2680" } } });
  }
  await prisma.user.update({ where: { id: user.id }, data: { activeAccountId: activeId } });
  console.log(`Seeded demo user ${email} / Passw0rd!`);
}


// =====================================================================================
// INDICATOR LAB + MARKETPLACE DEMO DATA (all fictional; backtests use SYNTHETIC data and say so)
// =====================================================================================
const PINE = (name: string) => `//@version=5
indicator("${name}", overlay=true)
emaFast = input.int(20, "Fast EMA", minval=1, maxval=500, group="Trend")
emaSlow = input.int(50, "Slow EMA", minval=2, maxval=1000, group="Trend")
atrMult = input.float(1.5, "ATR multiplier", minval=0.1, maxval=10, step=0.1)
useSession = input.bool(true, "Session filter")
plot(ta.ema(close, emaFast), "Fast")
plot(ta.ema(close, emaSlow), "Slow")`;

const EMA_DEF: StrategyDef = {
  direction: "both",
  longEntry: [{ l: { k: "ind", name: "ema", period: { param: "fast" } }, op: "crosses_above", r: { k: "ind", name: "ema", period: { param: "slow" } } }],
  shortEntry: [{ l: { k: "ind", name: "ema", period: { param: "fast" } }, op: "crosses_below", r: { k: "ind", name: "ema", period: { param: "slow" } } }],
  longExit: [], shortExit: [], exitOnOpposite: true, maxBarsInTrade: null, stop: { type: "atr", value: 1.5 }, target: { type: "rr", value: 2 }, sessions: null, defaults: { fast: 20, slow: 50 },
};

function simConfig(c: { t: number }[], over: Partial<BacktestConfig> = {}): BacktestConfig {
  const spec = presetFor("XAUUSD")!;
  return { symbol: "XAUUSD", timeframe: "H1", fromTs: c[0].t, toTs: c[c.length - 1].t, initialBalance: 10_000, riskPercent: 1, spread: 0.3, slippage: 0.05, commissionPerLot: 3.5, pipSize: 0.1, spec: { contractSize: spec.contractSize, tickSize: spec.tickSize, tickValue: spec.tickValue, minLot: spec.minLot, maxLot: spec.maxLot, lotStep: spec.lotStep, quoteCurrency: "USD" }, fxRate: 1, accountCurrency: "USD", params: { fast: 20, slow: 50 }, ...over };
}

async function seedMarketplace(demoUserId: string) {
  const hash = await bcrypt.hash("Passw0rd!", 12);
  for (const [i, c] of DEFAULT_CATEGORIES.entries()) await prisma.category.upsert({ where: { slug: c.slug }, create: { ...c, sort: i }, update: {} });

  // --- admin
  await prisma.user.deleteMany({ where: { email: { in: ["admin@riskpilot.app", "ada@creators.demo", "chidi@creators.demo", "tunde@creators.demo", ...Array.from({ length: 8 }, (_, i) => `buyer${i + 1}@demo.test`)] } } });
  const admin = await prisma.user.create({ data: { email: "admin@riskpilot.app", name: "Platform Admin", passwordHash: hash, role: "ADMIN" } });
  void admin;

  const candles = generateSyntheticCandles({ symbol: "XAUUSD", timeframe: "H1", days: 400, startPrice: 2400, seed: 424242 });
  const cfg = simConfig(candles);
  const mid = candles[Math.floor(candles.length * 0.7)].t;
  const wf = walkForward(candles, EMA_DEF, cfg, mid, { fast: 20, slow: 50 });

  // --- demo trader's own Lab content (Pro user)
  const ds = await prisma.dataset.create({ data: { userId: demoUserId, name: "SYNTHETIC XAUUSD H1", symbol: "XAUUSD", timeframe: "H1", source: "SYNTHETIC", candleCount: candles.length, fromTs: new Date(candles[0].t), toTs: new Date(candles[candles.length - 1].t), candles: candles.map((x) => [x.t, x.o, x.h, x.l, x.c, x.v]) } });
  const meta = parsePine(PINE("Gold Sniper V1"));
  const ind = await prisma.indicator.create({
    data: { userId: demoUserId, name: "Gold Sniper V1", description: "EMA trend filter for XAUUSD with a session filter. (Fictional demo indicator.)", author: "Demo Trader", markets: ["XAUUSD"], timeframes: ["M15", "H1", "H4"], pineVersion: 5, visibility: "PRIVATE", latestVersion: "1.2",
      versions: { create: [
        { version: "1.0", changelog: "Initial release", compatibility: "Pine Script v5", pineVersion: 5, inputs: meta.inputs as object[], releasedAt: new Date(Date.now() - 90 * 86_400_000), source: { create: { code: PINE("Gold Sniper V1"), sha256: "demo" } } },
        { version: "1.2", changelog: "- Added session filter\n- Added configurable EMA\n- Fixed calculation issue", compatibility: "Pine Script v5", pineVersion: 5, inputs: meta.inputs as object[], source: { create: { code: PINE("Gold Sniper V1") + "\n// v1.2", sha256: "demo2" } } },
      ] } },
  });
  const strat = await prisma.strategy.create({ data: { userId: demoUserId, indicatorId: ind.id, name: "Gold Sniper V1 + 1% Risk", symbol: "XAUUSD", description: "EMA cross entries; ATR stop; 2R target.", definition: EMA_DEF as object } });
  const full = buildReport(runBacktest(candles, EMA_DEF, cfg).trades, 10_000, "XAUUSD");
  const mkRun = (data: object) => prisma.backtestRun.create({ data: { userId: demoUserId, strategyId: strat.id, datasetId: ds.id, dataSource: "SYNTHETIC DEMO DATA", synthetic: true, ...(data as object) } as never });
  await mkRun({ kind: "SINGLE", sampleType: "FULL", label: "Full period, 0.3 spread", config: cfg, params: cfg.params, summary: full.stats, report: full, tradeCount: full.stats.trades });
  const gid = "wf_demo";
  await mkRun({ kind: "WALK_FORWARD", sampleType: "IN_SAMPLE", groupId: gid, label: "Walk-forward: in-sample", config: { ...cfg, toTs: wf.inSample.toTs }, params: cfg.params, summary: wf.inSample.report.stats, report: wf.inSample.report, tradeCount: wf.inSample.report.stats.trades });
  await mkRun({ kind: "WALK_FORWARD", sampleType: "OUT_OF_SAMPLE", groupId: gid, label: "Walk-forward: out-of-sample", config: { ...cfg, fromTs: wf.outOfSample.fromTs }, params: cfg.params, summary: wf.outOfSample.report.stats, report: wf.outOfSample.report, tradeCount: wf.outOfSample.report.stats.trades });
  const grid = [{ name: "fast", values: [10, 20, 30] }, { name: "slow", values: [50, 100] }];
  await mkRun({ kind: "OPTIMIZATION", sampleType: "FULL", label: "Parameter test (6 configurations)", config: cfg, summary: { combinations: 6 }, report: { rows: runOptimization(candles, EMA_DEF, cfg, grid), grid }, tradeCount: 0 });

  // --- creators, buyers
  const mkUser = (email: string, name: string) => prisma.user.create({ data: { email, name, passwordHash: hash, onboardedAt: new Date() } });
  const withAccount = async (u: { id: string }, name: string) => {
    const a = await prisma.account.create({ data: { userId: u.id, name, currency: "USD", startingBalance: 5000, instruments: ["XAUUSD"], riskSettings: { create: {} } } });
    await prisma.user.update({ where: { id: u.id }, data: { activeAccountId: a.id } });
  };
  const [ada, chidi, tunde] = await Promise.all([mkUser("ada@creators.demo", "Ada Obi"), mkUser("chidi@creators.demo", "Chidi Eze"), mkUser("tunde@creators.demo", "Tunde Bello")]);
  await Promise.all([withAccount(ada, "Ada main"), withAccount(chidi, "Chidi main"), withAccount(tunde, "Tunde main")]);
  const buyers = await Promise.all(Array.from({ length: 8 }, (_, i) => mkUser(`buyer${i + 1}@demo.test`, ["Ife", "Kemi", "Musa", "Zainab", "Emeka", "Ngozi", "Sade", "Bayo"][i] + " Demo")));
  const cAda = await prisma.creator.create({ data: { userId: ada.id, displayName: "Ada Obi", slug: "ada-obi", bio: "Builds gold and FX tools. Lagos.", verified: true, payoutMethodHint: "••••6789", payoutVerifiedAt: new Date() } });
  const cChidi = await prisma.creator.create({ data: { userId: chidi.id, displayName: "Chidi Eze", slug: "chidi-eze", bio: "Crypto trend tools.", verified: true } });
  const cTunde = await prisma.creator.create({ data: { userId: tunde.id, displayName: "Tunde Bello", slug: "tunde-bello", bio: "New creator." } });

  type L = { owner: typeof ada; creator: typeof cAda; name: string; slug: string; tagline: string; model: "FREE" | "ONE_TIME" | "MONTHLY" | "YEARLY"; cents: number; vis: "PUBLIC" | "UNLISTED"; status: "APPROVED" | "PENDING_REVIEW"; cats: string[]; markets: string[]; tfs: string[]; features: string[]; sourceIncluded?: boolean; evidence?: boolean };
  const defs: L[] = [
    { owner: ada, creator: cAda, name: "Gold Momentum Pro", slug: "gold-momentum-pro", tagline: "EMA momentum filter with session awareness for XAUUSD", model: "MONTHLY", cents: 1900, vis: "PUBLIC", status: "APPROVED", cats: ["gold", "momentum"], markets: ["XAUUSD"], tfs: ["M15", "H1", "H4"], features: ["Configurable EMA lengths", "London / New York session filter", "ATR-based stop and target levels you define", "Alert conditions"], evidence: true },
    { owner: chidi, creator: cChidi, name: "BTC Trend System", slug: "btc-trend-system", tagline: "Trend-following levels for BTCUSD with adjustable lookbacks", model: "ONE_TIME", cents: 2900, vis: "PUBLIC", status: "APPROVED", cats: ["crypto", "trend-following"], markets: ["BTCUSD"], tfs: ["H1", "H4"], features: ["Trend state colouring", "Donchian-style channel", "Documented inputs"], evidence: true },
    { owner: ada, creator: cAda, name: "Session Range Levels", slug: "session-range-levels", tagline: "Free: plots Asian, London and New York ranges", model: "FREE", cents: 0, vis: "PUBLIC", status: "APPROVED", cats: ["price-action", "forex"], markets: ["XAUUSD", "EURUSD", "GBPUSD"], tfs: ["M15", "H1"], features: ["Session boxes", "Previous-range levels"], sourceIncluded: true },
    { owner: chidi, creator: cChidi, name: "Breakout Box (unlisted)", slug: "breakout-box", tagline: "Shared by link only", model: "ONE_TIME", cents: 1500, vis: "UNLISTED", status: "APPROVED", cats: ["breakout"], markets: ["US30", "NAS100"], tfs: ["M15", "H1"], features: ["Opening-range box"] },
    { owner: tunde, creator: cTunde, name: "Scalper Grid X", slug: "scalper-grid-x", tagline: "Grid levels for M5 scalping on FX", model: "YEARLY", cents: 9900, vis: "PUBLIC", status: "PENDING_REVIEW", cats: ["scalping"], markets: ["EURUSD", "GBPUSD"], tfs: ["M5", "M15"], features: ["Adjustable grid spacing", "Spread display"] },
  ];

  const settings = DEFAULT_SETTINGS;
  const made: Record<string, string> = {};
  for (const d of defs) {
    const i = await prisma.indicator.create({ data: { userId: d.owner.id, name: d.name, description: d.tagline, author: d.owner.name ?? "", markets: d.markets, timeframes: d.tfs, pineVersion: 5, visibility: d.vis, latestVersion: d.model === "MONTHLY" ? "2.1" : "1.0",
      versions: { create: d.model === "MONTHLY"
        ? [{ version: "1.0", changelog: "Initial release", compatibility: "Pine v5", pineVersion: 5, releasedAt: new Date(Date.now() - 120 * 86_400_000), source: { create: { code: PINE(d.name), sha256: "x" } } }, { version: "2.0", changelog: "- Added session filter\n- Added configurable EMA", compatibility: "Pine v5", pineVersion: 5, releasedAt: new Date(Date.now() - 60 * 86_400_000), source: { create: { code: PINE(d.name), sha256: "y" } } }, { version: "2.1", changelog: "- Improved alert handling\n- Fixed calculation issue", compatibility: "Pine v5", pineVersion: 5, releasedAt: new Date(Date.now() - 10 * 86_400_000), source: { create: { code: PINE(d.name), sha256: "z" } } }]
        : [{ version: "1.0", changelog: "Initial release", compatibility: "Pine v5", pineVersion: 5, source: { create: { code: PINE(d.name), sha256: "x" } } }] } } });
    const l = await prisma.listing.create({ data: {
      indicatorId: i.id, creatorId: d.creator.id, slug: d.slug, title: d.name, tagline: d.tagline, categories: d.cats, features: d.features,
      description: `${d.tagline}.\n\nThis is a fictional demo product used to show how a marketplace listing looks. It draws and calculates levels from inputs you control and does not tell you when to buy or sell.`,
      documentation: "Installation: open TradingView, add the script to your chart from Indicators → Invite-only scripts, then open its settings.\n\nInputs: every input is explained in the tooltip. Defaults are starting points only.\n\nLimitations: results depend on your broker's data and contract specifications. Always verify specifications with your broker.",
      methodology: d.evidence ? "Rule-based simulation on 400 days of H1 candles. Signals at bar close, fills at next open, spread/slippage/commission applied, stop assumed first when both are touched." : "", dataSourceNote: d.evidence ? "SYNTHETIC DEMO DATA generated by RiskPilot for this demo — not real market prices." : "",
      pricingModel: d.model, priceUsdCents: d.cents, status: d.status, sourceIncluded: d.sourceIncluded ?? false, updatePolicy: "SAME_MAJOR", tradingViewAccess: d.model !== "FREE" && !d.sourceIncluded, allowBuyerBacktest: d.slug === "gold-momentum-pro",
      approvedAt: d.status === "APPROVED" ? new Date(Date.now() - 30 * 86_400_000) : null, submittedAt: new Date(Date.now() - 2 * 86_400_000), views: 150 + Math.floor(Math.random() * 600) } });
    made[d.slug] = l.id;
    if (d.evidence) {
      const sd = d.slug === "btc-trend-system" ? 200 : 400;
      void sd;
      const run = await prisma.backtestRun.create({ data: { userId: d.owner.id, kind: "WALK_FORWARD", sampleType: "OUT_OF_SAMPLE", groupId: `wf_${d.slug}`, label: "Out-of-sample (demo)", config: { ...cfg, fromTs: wf.outOfSample.fromTs } as object, params: cfg.params as object, summary: wf.outOfSample.report.stats as object, report: wf.outOfSample.report as object, tradeCount: wf.outOfSample.report.stats.trades, dataSource: "SYNTHETIC DEMO DATA", synthetic: true } });
      await prisma.listingEvidence.create({ data: { listingId: l.id, backtestRunId: run.id, note: "Parameters were fixed before this period. Demo data — synthetic." } });
    }
    if (d.slug === "gold-momentum-pro") await prisma.listing.update({ where: { id: l.id }, data: { strategyId: strat.id } }).catch(() => {});
  }
  // the buyer-test strategy must be owned by the creator; give Ada her own copy
  const adaStrat = await prisma.strategy.create({ data: { userId: ada.id, name: "Gold Momentum Pro rules", symbol: "XAUUSD", definition: EMA_DEF as object } });
  await prisma.listing.update({ where: { id: made["gold-momentum-pro"] }, data: { strategyId: adaStrat.id } });

  // --- sales, licenses, ledger
  const sell = async (buyer: typeof ada, slug: string, model: "ONE_TIME" | "MONTHLY", cents: number, creator: typeof cAda, daysAgo: number, refunded = false) => {
    const split = splitSale({ grossCents: cents, commissionPercent: settings.commissionPercent, processingFeePercent: settings.processingFeePercent, processingFeeFixedCents: 0, taxPercent: 0, feeBearer: settings.feeBearer });
    const when = new Date(Date.now() - daysAgo * 86_400_000);
    const order = await prisma.marketOrder.create({ data: { buyerId: buyer.id, listingId: made[slug], creatorId: creator.id, reference: `mp_demo_${slug}_${buyer.id.slice(-5)}`, provider: "mock", status: refunded ? "REFUNDED" : "PAID", pricingModel: model, currency: "USD", chargeMinor: cents, usdPerMinor: 1, grossUsdCents: cents, processingFeeUsdCents: split.processingFeeCents, commissionPercent: settings.commissionPercent, platformFeeUsdCents: split.commissionCents, creatorEarningUsdCents: split.creatorCents, feeBearer: settings.feeBearer, paidAt: when, refundedAt: refunded ? new Date() : null, refundReason: refunded ? "Customer request" : null, createdAt: when } });
    await prisma.license.create({ data: { userId: buyer.id, listingId: made[slug], orderId: order.id, status: refunded ? "REFUNDED" : "ACTIVE", type: model, startedAt: when, currentPeriodEnd: model === "MONTHLY" ? new Date(when.getTime() + (31 + 31 * Math.floor(daysAgo / 31)) * 86_400_000) : null, maxMajor: 1, tradingViewUsername: model === "MONTHLY" ? `tv_${buyer.name?.split(" ")[0].toLowerCase()}` : null } });
    const availableAt = new Date(when.getTime() + settings.holdbackDays * 86_400_000);
    await prisma.ledgerEntry.create({ data: { creatorId: creator.id, orderId: order.id, kind: "SALE", amountUsdCents: split.creatorCents, availableAt, createdAt: when, note: "Sale" } });
    if (refunded) await prisma.ledgerEntry.create({ data: { creatorId: creator.id, orderId: order.id, kind: "REFUND", amountUsdCents: -split.creatorCents, availableAt, note: "Refund" } });
  };
  for (const [i, b] of buyers.slice(0, 6).entries()) await sell(b, "gold-momentum-pro", "MONTHLY", 1900, cAda, 3 + i * 6);
  await sell(buyers[6], "gold-momentum-pro", "MONTHLY", 1900, cAda, 20, true);
  for (const [i, b] of buyers.slice(2, 6).entries()) await sell(b, "btc-trend-system", "ONE_TIME", 2900, cChidi, 5 + i * 9);
  for (const b of buyers.slice(0, 3)) await prisma.license.create({ data: { userId: b.id, listingId: made["session-range-levels"], status: "ACTIVE", type: "FREE", maxMajor: 1 } });
  // demo trader owns one free + one paid product so "My Indicators" is populated
  await prisma.license.create({ data: { userId: demoUserId, listingId: made["session-range-levels"], status: "ACTIVE", type: "FREE", maxMajor: 1 } });
  const dOrder = await prisma.marketOrder.create({ data: { buyerId: demoUserId, listingId: made["gold-momentum-pro"], creatorId: cAda.id, reference: "mp_demo_demo_user", provider: "mock", status: "PAID", pricingModel: "MONTHLY", currency: "USD", chargeMinor: 1900, grossUsdCents: 1900, processingFeeUsdCents: 38, commissionPercent: 20, platformFeeUsdCents: 372, creatorEarningUsdCents: 1490, paidAt: new Date(Date.now() - 4 * 86_400_000) } });
  await prisma.license.create({ data: { userId: demoUserId, listingId: made["gold-momentum-pro"], orderId: dOrder.id, status: "ACTIVE", type: "MONTHLY", startedAt: new Date(Date.now() - 4 * 86_400_000), currentPeriodEnd: new Date(Date.now() + 27 * 86_400_000), maxMajor: 1, tradingViewUsername: "demo_trader" } });
  await prisma.ledgerEntry.create({ data: { creatorId: cAda.id, orderId: dOrder.id, kind: "SALE", amountUsdCents: 1490, availableAt: new Date(Date.now() + 3 * 86_400_000) } });

  // --- reviews (buyers who really have access; the refunded buyer has none)
  const rv = (slug: string, user: typeof ada, rating: number, title: string, body: string, verified = true) => prisma.review.create({ data: { listingId: made[slug], userId: user.id, rating, title, body, verifiedPurchase: verified } });
  await rv("gold-momentum-pro", buyers[0], 5, "Clear and well documented", "The session filter is handy and the inputs are explained. I still verify my own risk on every trade.");
  await rv("gold-momentum-pro", buyers[1], 4, "Good tool, steep learning curve", "Took me a while to understand the ATR settings. Support answered quickly.");
  await rv("gold-momentum-pro", buyers[2], 3, "Fine", "Does what it says. Not a magic bullet, which the listing is honest about.");
  await rv("btc-trend-system", buyers[3], 4, "Simple and readable", "Nice trend colouring. Works on H4 for me.");
  await rv("session-range-levels", buyers[0], 5, "Free and useful", "Great for marking the Asian range.", false);
  await prisma.report.create({ data: { reporterId: buyers[4].id, listingId: made["scalper-grid-x"], reason: "Misleading claims", details: "Demo report so the admin queue has an item." } });
  await prisma.auditLog.create({ data: { actorId: admin.id, action: "LISTING_APPROVE", targetType: "listing", targetId: made["gold-momentum-pro"], meta: { note: "demo" } } });
  console.log("Seeded marketplace demo: admin@riskpilot.app / Passw0rd!, creators ada@creators.demo, chidi@creators.demo, tunde@creators.demo (Passw0rd!)");
}

async function run() {
  await main();
  const demo = await prisma.user.findUniqueOrThrow({ where: { email: "demo@riskpilot.app" } });
  await seedMarketplace(demo.id);
}
run().finally(() => prisma.$disconnect());
