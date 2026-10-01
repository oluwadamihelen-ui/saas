import { describe, expect, it } from "vitest";
import { atr, ema, rsi, sma, highest, lowest } from "@/lib/lab/indicators";
import { collectParams, labSession, runBacktest, validateConfig, validateStrategy } from "@/lib/lab/backtest";
import { buildReport, statsOf } from "@/lib/lab/report";
import { expandGrid, parseValues, runOptimization, walkForward } from "@/lib/lab/optimize";
import { generateSyntheticCandles, parseCandleCsv, timeframeFromCandles } from "@/lib/lab/candles";
import type { BacktestConfig, Candle, StrategyDef } from "@/lib/lab/types";

const H = 3_600_000;
const T0 = Date.UTC(2026, 0, 5, 0, 0, 0); // a Monday

/** XAUUSD-like spec: $100 per lot per 1.0 price move. */
const spec = { contractSize: 100, tickSize: 0.01, tickValue: 1, minLot: 0.01, maxLot: 100, lotStep: 0.01, quoteCurrency: "USD" };
const cfg = (over: Partial<BacktestConfig> = {}): BacktestConfig => ({
  symbol: "XAUUSD", timeframe: "H1", fromTs: T0, toTs: T0 + 10_000 * H, initialBalance: 10_000, riskPercent: 1,
  spread: 0, slippage: 0, commissionPerLot: 0, pipSize: 0.1, spec, fxRate: 1, accountCurrency: "USD", ...over,
});

function bars(closes: number[], opts: { range?: number } = {}): Candle[] {
  const r = opts.range ?? 0.1;
  return closes.map((c, i) => ({ t: T0 + i * H, o: i === 0 ? c : closes[i - 1], h: Math.max(c, i === 0 ? c : closes[i - 1]) + r, l: Math.min(c, i === 0 ? c : closes[i - 1]) - r, c, v: 100 }));
}

const longWhenCloseAbove = (level: number, over: Partial<StrategyDef> = {}): StrategyDef => ({
  direction: "long",
  longEntry: [{ l: { k: "price", f: "close" }, op: "gt", r: { k: "num", v: level } }],
  shortEntry: [], longExit: [], shortExit: [], exitOnOpposite: false, maxBarsInTrade: null,
  stop: { type: "distance", value: 2 }, target: { type: "rr", value: 2 }, sessions: null, ...over,
});

describe("indicators", () => {
  it("sma", () => expect(sma([1, 2, 3, 4, 5], 3).map((x) => (Number.isNaN(x) ? null : x))).toEqual([null, null, 2, 3, 4]));
  it("ema seeds with the SMA and then smooths", () => {
    const e = ema([1, 2, 3, 4, 5], 3);
    expect(e[2]).toBe(2);
    expect(e[3]).toBeCloseTo(3); // k=0.5: 4*0.5 + 2*0.5
    expect(e[4]).toBeCloseTo(4);
  });
  it("rsi: all gains → 100, all losses → 0, flat → 50", () => {
    expect(rsi([1, 2, 3, 4, 5, 6], 3)[5]).toBe(100);
    expect(rsi([6, 5, 4, 3, 2, 1], 3)[5]).toBe(0);
    expect(rsi([5, 5, 5, 5, 5, 5], 3)[5]).toBe(50);
  });
  it("atr of constant-range candles equals the range", () => {
    const c: Candle[] = Array.from({ length: 30 }, (_, i) => ({ t: i, o: 100, h: 101, l: 99, c: 100, v: 0 }));
    expect(atr(c, 14)[29]).toBeCloseTo(2);
  });
  it("highest/lowest look at the PREVIOUS n bars only", () => {
    expect(highest([1, 5, 2, 3], 2)[3]).toBe(5);
    expect(highest([1, 5, 2, 9], 2)[3]).toBe(5); // current bar's 9 is excluded
    expect(lowest([4, 1, 3, 0], 2)[3]).toBe(1);
  });
});

describe("simulator mechanics", () => {
  it("fills at the NEXT bar's open — never on the signal bar (no look-ahead)", () => {
    const closes = [...Array(60).fill(100), 101, 101.2, 101.2, 101.2];
    const c = bars(closes);
    c[61] = { ...c[61], o: 101.2 };
    const r = runBacktest(c, longWhenCloseAbove(100.5), cfg({ spread: 0.2 }));
    expect(r.trades.length).toBeGreaterThan(0);
    const t = r.trades[0];
    expect(t.entryTime).toBe(c[61].t); // signal on bar 60, fill on bar 61
    expect(t.entry).toBeCloseTo(101.2 + 0.1); // open + spread/2
  });

  it("stop-loss hit loses exactly 1R with zero costs", () => {
    const closes = [...Array(60).fill(100), 101, 101, 98, 98, 98];
    const r = runBacktest(bars(closes), longWhenCloseAbove(100.5), cfg());
    const t = r.trades[0];
    expect(t.exitReason).toBe("stop");
    expect(t.rMultiple).toBeCloseTo(-1, 6);
    expect(t.riskAmount).toBeCloseTo(100, 4); // 1% of 10,000
  });

  it("take-profit at 2R wins exactly 2R with zero costs", () => {
    const closes = [...Array(60).fill(100), 101, 101, 106, 106, 106];
    const r = runBacktest(bars(closes, { range: 0.05 }), longWhenCloseAbove(100.5), cfg());
    const t = r.trades[0];
    expect(t.exitReason).toBe("take_profit");
    expect(t.rMultiple).toBeCloseTo(2, 6);
  });

  it("when stop and target are both inside one bar the STOP is assumed to hit first", () => {
    const c = bars([...Array(60).fill(100), 101, 101, 101, 101]);
    c[62] = { ...c[62], o: 101, h: 110, l: 90, c: 101 }; // touches both the 2-point stop and the 4-point target
    const r = runBacktest(c, longWhenCloseAbove(100.5), cfg());
    expect(r.trades[0].exitReason).toBe("stop");
  });

  it("a gap through the stop fills at the gap price (worse than 1R)", () => {
    const c = bars([...Array(60).fill(100), 101, 101, 101, 101]);
    c[62] = { t: c[62].t, o: 95, h: 95.2, l: 94.8, c: 95, v: 1 };
    const r = runBacktest(c, longWhenCloseAbove(100.5), cfg());
    expect(r.trades[0].exitReason).toBe("stop");
    expect(r.trades[0].rMultiple).toBeLessThan(-1.5);
  });

  it("spread, slippage and commission all reduce results", () => {
    const closes = [...Array(60).fill(100), 101, 101, 106, 106, 106];
    const free = runBacktest(bars(closes, { range: 0.05 }), longWhenCloseAbove(100.5), cfg()).trades[0];
    const costly = runBacktest(bars(closes, { range: 0.05 }), longWhenCloseAbove(100.5), cfg({ spread: 0.4, slippage: 0.1, commissionPerLot: 3.5 })).trades[0];
    expect(costly.pnl).toBeLessThan(free.pnl);
    expect(costly.commission).toBeCloseTo(costly.lots * 3.5 * 2, 6);
  });

  it("short trades profit when price falls", () => {
    const def: StrategyDef = { ...longWhenCloseAbove(0), direction: "short", longEntry: [], shortEntry: [{ l: { k: "price", f: "close" }, op: "lt", r: { k: "num", v: 99.5 } }] };
    const r = runBacktest(bars([...Array(60).fill(100), 99, 99, 94, 94, 94], { range: 0.05 }), def, cfg());
    expect(r.trades[0].direction).toBe("SHORT");
    expect(r.trades[0].rMultiple).toBeCloseTo(2, 6);
  });

  it("skips trades when the minimum lot would exceed the risk budget, and says so", () => {
    const r = runBacktest(bars([...Array(60).fill(100), 101, 101, 106, 106]), longWhenCloseAbove(100.5), cfg({ initialBalance: 100 })); // $1 risk vs $200/lot
    expect(r.trades).toHaveLength(0);
    expect(r.skipped.belowMinLot).toBeGreaterThan(0);
    expect(r.warnings.join(" ")).toMatch(/minimum lot/);
  });

  it("exits on a defined exit signal at the next open, and on max bars", () => {
    const def = longWhenCloseAbove(100.5, { longExit: [{ l: { k: "price", f: "close" }, op: "lt", r: { k: "num", v: 100.5 } }], target: { type: "none", value: 0 }, stop: { type: "distance", value: 50 } });
    const r = runBacktest(bars([...Array(60).fill(100), 101, 101, 101, 100, 100, 100]), def, cfg());
    expect(r.trades[0].exitReason).toBe("signal");
    const r2 = runBacktest(bars([...Array(60).fill(100), 101, 101, 101, 101, 101, 101, 101]), { ...def, longExit: [], maxBarsInTrade: 2 }, cfg());
    expect(r2.trades[0].exitReason).toBe("max_bars");
    expect(r2.trades[0].barsHeld).toBe(2);
  });

  it("closes an open position at the end of the data and says so", () => {
    const r = runBacktest(bars([...Array(60).fill(100), 101, 101, 101.2, 101.4]), longWhenCloseAbove(100.5, { stop: { type: "distance", value: 50 }, target: { type: "none", value: 0 } }), cfg());
    expect(r.trades[0].exitReason).toBe("end_of_data");
  });

  it("session filter only allows entries inside chosen sessions", () => {
    const c = bars([...Array(60).fill(100), 101, 101, 106, 106, 106]);
    const entrySession = labSession(c[61].t);
    const blocked = runBacktest(c, longWhenCloseAbove(100.5, { sessions: ["New York"] }), cfg());
    expect(entrySession).not.toBe("New York");
    // The signal stays true, so the filter only DELAYS entry until the next allowed session — never enters outside it.
    expect(blocked.trades.every((t) => t.session === "New York")).toBe(true);
    expect(blocked.trades.every((t) => t.entryTime > c[61].t)).toBe(true);
    const allowed = runBacktest(c, longWhenCloseAbove(100.5, { sessions: [entrySession] }), cfg());
    expect(allowed.trades[0].entryTime).toBe(c[61].t);
  });

  it("session labels", () => {
    const at = (h: number) => Date.UTC(2026, 0, 5, h);
    expect([labSession(at(3)), labSession(at(9)), labSession(at(14)), labSession(at(18)), labSession(at(22))]).toEqual(["Asian", "London", "London/NY overlap", "New York", "Off-hours"]);
  });
});

describe("an indicator is not a strategy", () => {
  const empty: StrategyDef = { direction: "both", longEntry: [], shortEntry: [], longExit: [], shortExit: [], exitOnOpposite: false, maxBarsInTrade: null, stop: { type: "pips", value: 20 }, target: { type: "rr", value: 2 }, sessions: null };
  it("refuses to run without explicit entry rules", () => {
    expect(validateStrategy(empty)[0]).toMatch(/indicator alone is not a strategy/i);
    expect(() => runBacktest(bars(Array(100).fill(100)), empty, cfg())).toThrow(/entry rule/);
  });
  it("validates the config", () => {
    expect(validateConfig(cfg({ initialBalance: 0 }))[0]).toMatch(/balance/);
    expect(validateConfig(cfg({ riskPercent: 120 }))[0]).toMatch(/Risk/);
    expect(validateConfig(cfg({ spread: -1 }))[0]).toMatch(/negative/);
    expect(validateConfig(cfg({ toTs: T0 - 1 }))[0]).toMatch(/end date/);
    expect(validateConfig(cfg({ spec: { ...spec, tickValue: 0 } }))[0]).toMatch(/specification/);
  });
});

describe("no look-ahead (property)", () => {
  const candles = generateSyntheticCandles({ symbol: "XAUUSD", timeframe: "H1", days: 120, startPrice: 2400, seed: 7 });
  const def: StrategyDef = {
    direction: "both",
    longEntry: [{ l: { k: "ind", name: "ema", period: 20 }, op: "crosses_above", r: { k: "ind", name: "ema", period: 50 } }],
    shortEntry: [{ l: { k: "ind", name: "ema", period: 20 }, op: "crosses_below", r: { k: "ind", name: "ema", period: 50 } }],
    longExit: [], shortExit: [], exitOnOpposite: true, maxBarsInTrade: null,
    stop: { type: "atr", value: 1.5 }, target: { type: "rr", value: 2 }, sessions: null,
  };
  const c = cfg({ fromTs: candles[0].t, toTs: candles[candles.length - 1].t, spread: 0.3, slippage: 0.05, commissionPerLot: 3 });

  it("trades that closed before a cut-off are identical when the future is removed", () => {
    const full = runBacktest(candles, def, c);
    expect(full.trades.length).toBeGreaterThan(5);
    const cut = candles[Math.floor(candles.length * 0.6)].t;
    const truncated = runBacktest(candles.filter((x) => x.t <= cut), def, { ...c, toTs: cut });
    const before = full.trades.filter((t) => t.exitTime < cut - 2 * H);
    expect(before.length).toBeGreaterThan(2);
    expect(truncated.trades.slice(0, before.length)).toEqual(before);
  });
  it("is deterministic", () => expect(runBacktest(candles, def, c)).toEqual(runBacktest(candles, def, c)));
  it("respects the date range (no trade is opened outside it)", () => {
    const from = candles[400].t, to = candles[1400].t;
    const r = runBacktest(candles, def, { ...c, fromTs: from, toTs: to });
    expect(r.trades.every((t) => t.entryTime >= from && t.exitTime <= to)).toBe(true);
  });
});

describe("report", () => {
  const mk = (pnl: number, r: number, day: number, hour = 10, dir: "LONG" | "SHORT" = "LONG") => ({ entryTime: Date.UTC(2026, 0, day, hour), exitTime: Date.UTC(2026, 0, day, hour + 1), direction: dir, pnl, rMultiple: r, riskAmount: 100, barsHeld: 3 });
  const trades = [mk(200, 2, 5), mk(-100, -1, 6), mk(-100, -1, 7), mk(300, 3, 8, 14), mk(-100, -1, 9, 3, "SHORT")];
  it("computes the headline statistics", () => {
    const s = statsOf(trades, 10_000);
    expect(s.trades).toBe(5);
    expect(s.winRate).toBe(40);
    expect(s.netPnl).toBe(200);
    expect(s.profitFactor).toBeCloseTo(500 / 300);
    expect(s.avgR).toBeCloseTo(0.4);
    expect(s.totalR).toBeCloseTo(2);
    expect(s.avgWin).toBe(250);
    expect(s.avgLoss).toBeCloseTo(-100);
    expect(s.largestWin).toBe(300);
    expect(s.largestLoss).toBe(-100);
    expect(s.maxLossStreak).toBe(2);
    expect(s.maxWinStreak).toBe(1);
    expect(s.maxDrawdownAmount).toBeCloseTo(200);
    expect(s.longs).toBe(4);
  });
  it("breaks results down by session / hour / weekday / direction / month and labels them neutrally", () => {
    const r = buildReport(trades, 10_000, "XAUUSD");
    expect(r.label).toMatch(/Historical backtest results/);
    expect(r.label).toMatch(/does not predict/);
    expect(r.sessions.map((x) => x.key)).toEqual(["Asian", "London", "London/NY overlap"]);
    expect(r.sessions.find((x) => x.key === "Asian")?.trades).toBe(1);
    expect(r.hours.map((x) => x.key)).toContain("14");
    expect(r.weekdays[0].key).toBe("Mon");
    expect(r.directions.map((x) => x.key).sort()).toEqual(["Long", "Short"]);
    expect(r.monthly).toHaveLength(1);
    expect(r.instruments[0].key).toBe("XAUUSD");
    expect(r.smallSample).toBe(true);
    expect(r.equity[0].equity).toBe(10_000);
    expect(r.equity.at(-1)?.equity).toBe(10_200);
    expect(JSON.stringify(r).toLowerCase()).not.toMatch(/profitable|best|winning strategy/);
  });
  it("handles zero trades", () => {
    const s = statsOf([], 1000);
    expect(s.trades).toBe(0);
    expect(s.profitFactor).toBeNull();
    expect(s.avgR).toBeNull();
    expect(buildReport([], 1000).equity).toHaveLength(1);
  });
});

describe("optimization & walk-forward", () => {
  const candles = generateSyntheticCandles({ symbol: "XAUUSD", timeframe: "H1", days: 200, startPrice: 2400, seed: 11 });
  const def: StrategyDef = {
    direction: "both",
    longEntry: [{ l: { k: "ind", name: "ema", period: { param: "fast" } }, op: "crosses_above", r: { k: "ind", name: "ema", period: { param: "slow" } } }],
    shortEntry: [{ l: { k: "ind", name: "ema", period: { param: "fast" } }, op: "crosses_below", r: { k: "ind", name: "ema", period: { param: "slow" } } }],
    longExit: [], shortExit: [], exitOnOpposite: true, maxBarsInTrade: null,
    stop: { type: "atr", value: { param: "stopAtr" } }, target: { type: "rr", value: 2 }, sessions: null,
  };
  const c = cfg({ fromTs: candles[0].t, toTs: candles.at(-1)!.t, spread: 0.3 });

  it("finds the parameters a strategy uses", () => expect(collectParams(def).sort()).toEqual(["fast", "slow", "stopAtr"]));
  it("parses value lists and ranges, with limits", () => {
    expect(parseValues("20, 50 100")).toEqual([20, 50, 100]);
    expect(parseValues("10-30:10")).toEqual([10, 20, 30]);
    expect(() => parseValues("1-100:1")).toThrow(/at most/);
    expect(() => parseValues("a,b")).toThrow(/number/);
    expect(parseValues("")).toEqual([]);
  });
  it("expands a grid and enforces the combination cap", () => {
    expect(expandGrid([{ name: "a", values: [1, 2] }, { name: "b", values: [3, 4, 5] }])).toHaveLength(6);
    expect(() => expandGrid([{ name: "a", values: parseValues("1-10:1") }, { name: "b", values: parseValues("1-10:1") }])).toThrow(/limit/);
    expect(() => expandGrid([])).toThrow(/Add at least one/);
  });
  it("returns every configuration in input order, unranked and without any 'best' flag", () => {
    const rows = runOptimization(candles, def, c, [{ name: "fast", values: [10, 20] }, { name: "slow", values: [50, 100] }, { name: "stopAtr", values: [1.5] }]);
    expect(rows.map((r) => r.params)).toEqual([{ fast: 10, slow: 50, stopAtr: 1.5 }, { fast: 10, slow: 100, stopAtr: 1.5 }, { fast: 20, slow: 50, stopAtr: 1.5 }, { fast: 20, slow: 100, stopAtr: 1.5 }]);
    expect(JSON.stringify(rows)).not.toMatch(/best|rank|optimal/i);
    expect(rows.every((r) => r.stats.trades > 0)).toBe(true);
  });
  it("walk-forward reports in-sample and out-of-sample separately, with no overlap", () => {
    const split = candles[Math.floor(candles.length * 0.7)].t;
    const wf = walkForward(candles, def, c, split, { fast: 20, slow: 50, stopAtr: 1.5 });
    expect(wf.inSample.report.stats.trades).toBeGreaterThan(0);
    expect(wf.outOfSample.report.stats.trades).toBeGreaterThan(0);
    expect(wf.inSample.report.trades.every((t) => t.entryTime < split)).toBe(true);
    expect(wf.outOfSample.report.trades.every((t) => t.entryTime >= split)).toBe(true);
    expect(() => walkForward(candles, def, c, c.fromTs - 1, {})).toThrow(/split date/);
  });
});

describe("candle import & synthetic data", () => {
  it("parses a TradingView/ISO style CSV and a MT5 date+time CSV", () => {
    const rows = Array.from({ length: 60 }, (_, i) => `${new Date(T0 + i * H).toISOString()},100,101,99,100.5,10`);
    const a = parseCandleCsv(["time,open,high,low,close,volume", ...rows].join("\n"));
    expect(a.error).toBeUndefined();
    expect(a.candles).toHaveLength(60);
    expect(timeframeFromCandles(a.candles)).toBe("H1");
    const mt = Array.from({ length: 60 }, (_, i) => { const d = new Date(T0 + i * H); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())},${p(d.getUTCHours())}:00,100,101,99,100.5,10`; });
    const b = parseCandleCsv(["Date,Time,Open,High,Low,Close,Tick Volume", ...mt].join("\n"));
    expect(b.error).toBeUndefined();
    expect(b.candles[1].t - b.candles[0].t).toBe(H);
  });
  it("sorts, de-duplicates and rejects bad candles", () => {
    const ts = (k: number) => 1_700_000_000 + k * 3600; // unix seconds
    const good = Array.from({ length: 80 }, (_, i) => `${ts(((i * 37) % 80) + 1)},100,101,99,100,1`); // shuffled, unique
    const bad = [`${ts(200)},100,99,101,100,1`, `${ts(201)},abc,1,1,1,1`]; // high < low; non-numeric
    const r = parseCandleCsv(["time,open,high,low,close,volume", ...good, `${ts(10)},100,101,99,100,1`, ...bad].join("\n"));
    expect(r.error).toBeUndefined();
    expect(r.skipped).toBe(2);
    expect(r.warnings.join(" ")).toMatch(/duplicate/);
    expect(r.candles.every((x, i, a) => i === 0 || x.t > a[i - 1].t)).toBe(true);
  });
  it("rejects missing columns and tiny files", () => {
    expect(parseCandleCsv("a,b\n1,2").error).toMatch(/Couldn't find/);
    expect(parseCandleCsv("time,open,high,low,close\n1,1,1,1,1").error).toMatch(/at least 50|no data/);
  });
  it("synthetic candles are deterministic, valid and skip weekends", () => {
    const a = generateSyntheticCandles({ symbol: "X", timeframe: "H1", days: 30, startPrice: 100, seed: 3 });
    expect(a).toEqual(generateSyntheticCandles({ symbol: "X", timeframe: "H1", days: 30, startPrice: 100, seed: 3 }));
    expect(a.every((x) => x.h >= x.l && x.h >= Math.max(x.o, x.c) && x.l <= Math.min(x.o, x.c) && x.c > 0)).toBe(true);
    expect(a.some((x) => new Date(x.t).getUTCDay() === 6)).toBe(false);
  });
});
