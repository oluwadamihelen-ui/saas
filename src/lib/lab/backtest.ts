/**
 * Rule-based backtester (pure).
 *
 * Execution model — deliberately conservative and free of look-ahead:
 *  • Signals are evaluated on a bar's CLOSE; the order fills at the NEXT bar's OPEN.
 *  • Candles are treated as mid prices. Longs buy at mid+spread/2 and sell at mid−spread/2
 *    (shorts the reverse); slippage is always adverse. Commission is charged per lot, per side.
 *  • Stops/targets are checked inside each bar using high/low. If both are touched in the
 *    same bar the STOP is assumed to hit first. Gaps through a stop fill at the gap price.
 *  • One position at a time. Risk % is taken from the CURRENT balance (compounding).
 *  • Lot size comes from the same risk-first sizing as the calculator (rounded DOWN to the lot
 *    step; trades below the broker's minimum lot are skipped and counted).
 * Results are a SIMULATION on past data — never a prediction.
 */
import { allTrue, compileConds, operandSeries, resolveNum, type Series } from "./indicators";
import { calculatePositionSize } from "@/lib/engine/risk";
import { LAB_SESSIONS, type BacktestConfig, type Candle, type Cond, type ExitReason, type LabSession, type Num, type Operand, type SimTrade, type StrategyDef } from "./types";

export function labSession(tMs: number): LabSession {
  const h = new Date(tMs).getUTCHours();
  if (h >= 7 && h < 13) return "London";
  if (h >= 13 && h < 16) return "London/NY overlap";
  if (h >= 16 && h < 21) return "New York";
  if (h >= 0 && h < 7) return "Asian";
  return "Off-hours";
}

export interface BacktestResult {
  trades: SimTrade[];
  skipped: { belowMinLot: number; conflictingSignals: number };
  finalBalance: number;
  ruined: boolean;
  warnings: string[];
}

// ------------------------------------------------------------------ validation helpers

function numParams(n: Num | undefined, out: Set<string>) {
  if (n && typeof n === "object") out.add(n.param);
}
function operandParams(o: Operand, out: Set<string>) {
  if (o.k === "ind") numParams(o.period, out);
  if (o.k === "num") numParams(o.v, out);
}
/** Every named parameter the strategy references (used by the optimizer UI). */
export function collectParams(def: StrategyDef): string[] {
  const out = new Set<string>();
  for (const list of [def.longEntry, def.shortEntry, def.longExit, def.shortExit]) for (const c of list) { operandParams(c.l, out); operandParams(c.r, out); }
  numParams(def.stop.value, out); numParams(def.stop.atrPeriod, out);
  numParams(def.target.value, out); numParams(def.target.atrPeriod, out);
  return [...out];
}

export function validateStrategy(def: StrategyDef): string[] {
  const errs: string[] = [];
  const longOn = def.direction !== "short" && def.longEntry.length > 0;
  const shortOn = def.direction !== "long" && def.shortEntry.length > 0;
  if (!longOn && !shortOn) errs.push("Define at least one entry rule. An indicator alone is not a strategy — nothing is traded until you say when to enter.");
  if (def.stop.type !== "pips" && def.stop.type !== "distance" && def.stop.type !== "atr" && def.stop.type !== "percent") errs.push("Choose a stop-loss type.");
  const tooMany = [def.longEntry, def.shortEntry, def.longExit, def.shortExit].some((l) => l.length > 6);
  if (tooMany) errs.push("Use at most 6 conditions per rule.");
  return errs;
}

export function validateConfig(cfg: BacktestConfig): string[] {
  const e: string[] = [];
  if (!(cfg.initialBalance > 0)) e.push("Initial balance must be above zero.");
  if (!(cfg.riskPercent > 0 && cfg.riskPercent <= 100)) e.push("Risk per trade must be between 0 and 100%.");
  if (!(cfg.spread >= 0) || !(cfg.slippage >= 0) || !(cfg.commissionPerLot >= 0)) e.push("Spread, slippage and commission can't be negative.");
  if (!(cfg.pipSize > 0)) e.push("Pip size must be above zero.");
  const s = cfg.spec;
  if (![s.contractSize, s.tickSize, s.tickValue, s.minLot, s.maxLot, s.lotStep, cfg.fxRate].every((x) => x > 0)) e.push("Contract specification values must all be above zero.");
  if (s.maxLot < s.minLot) e.push("Max lot must be at least min lot.");
  if (!(cfg.toTs > cfg.fromTs)) e.push("The end date must be after the start date.");
  return e;
}

function dist(kind: string, value: number, entry: number, atrAt: number | null, pipSize: number): number {
  switch (kind) {
    case "pips": return value * pipSize;
    case "distance": return value;
    case "percent": return (entry * value) / 100;
    case "atr": return atrAt === null ? NaN : atrAt * value;
    default: return NaN;
  }
}

// ------------------------------------------------------------------ simulation

export function runBacktest(candles: Candle[], def: StrategyDef, cfg: BacktestConfig): BacktestResult {
  const problems = [...validateStrategy(def), ...validateConfig(cfg)];
  if (problems.length) throw new Error(problems[0]);
  const params = cfg.params;
  const cache = new Map<string, Series>();
  const warnings: string[] = [];

  const longOn = def.direction !== "short" && def.longEntry.length > 0;
  const shortOn = def.direction !== "long" && def.shortEntry.length > 0;
  const longEntry = longOn ? compileConds(def.longEntry, candles, params, cache) : [];
  const shortEntry = shortOn ? compileConds(def.shortEntry, candles, params, cache) : [];
  const longExit = compileConds(def.longExit, candles, params, cache);
  const shortExit = compileConds(def.shortExit, candles, params, cache);

  const stopV = resolveNum(def.stop.value, params);
  const stopAtr = def.stop.type === "atr" ? operandSeries({ k: "ind", name: "atr", period: def.stop.atrPeriod ?? 14 }, candles, params, cache) : null;
  const tgtV = def.target.type === "none" ? 0 : resolveNum(def.target.value, params);
  const tgtAtr = def.target.type === "atr" ? operandSeries({ k: "ind", name: "atr", period: def.target.atrPeriod ?? 14 }, candles, params, cache) : null;

  const pointValue = (cfg.spec.tickValue / cfg.spec.tickSize) * cfg.fxRate; // account currency per lot per 1.0 price unit
  const half = cfg.spread / 2;
  const slip = cfg.slippage;
  const maxBars = def.maxBarsInTrade && def.maxBarsInTrade > 0 ? def.maxBarsInTrade : null;
  const sessions = def.sessions && def.sessions.length ? new Set<string>(def.sessions) : null;

  const trades: SimTrade[] = [];
  const skipped = { belowMinLot: 0, conflictingSignals: 0 };
  let balance = cfg.initialBalance;
  let ruined = false;

  type Pos = { dir: 1 | -1; entryT: number; entry: number; stop: number; tp: number | null; lots: number; risk: number; startIdx: number };
  let pos: Pos | null = null;
  let pendingEntry: { dir: 1 | -1; sigIdx: number } | null = null;
  let pendingExit: ExitReason | null = null;

  const close = (j: number, price: number, reason: ExitReason, tExit: number) => {
    const p = pos!;
    const commission = cfg.commissionPerLot * p.lots * 2;
    const pnl = (price - p.entry) * p.dir * p.lots * pointValue - commission;
    trades.push({
      entryTime: p.entryT, exitTime: tExit, direction: p.dir === 1 ? "LONG" : "SHORT", entry: p.entry, exit: price, stop: p.stop, target: p.tp,
      lots: p.lots, riskAmount: p.risk, commission, pnl, rMultiple: p.risk > 0 ? pnl / p.risk : 0, exitReason: reason, barsHeld: j - p.startIdx, session: labSession(p.entryT),
    });
    balance += pnl;
    pos = null;
    if (balance <= 0) ruined = true;
  };

  const open = (j: number, dir: 1 | -1, sigIdx: number): boolean => {
    const mid = candles[j].o;
    const fill = dir === 1 ? mid + half + slip : mid - half - slip;
    const sd = dist(def.stop.type, stopV, fill, stopAtr ? stopAtr[sigIdx] : null, cfg.pipSize);
    if (!Number.isFinite(sd) || sd <= 0) return false;
    const riskAmount = (balance * cfg.riskPercent) / 100;
    const size = calculatePositionSize(riskAmount, sd * pointValue, cfg.spec);
    if (size.lots <= 0) { skipped.belowMinLot++; return false; }
    let tp: number | null = null;
    if (def.target.type !== "none") {
      const td = def.target.type === "rr" ? sd * tgtV : dist(def.target.type, tgtV, fill, tgtAtr ? tgtAtr[sigIdx] : null, cfg.pipSize);
      if (Number.isFinite(td) && td > 0) tp = fill + dir * td;
    }
    pos = { dir, entryT: candles[j].t, entry: fill, stop: fill - dir * sd, tp, lots: size.lots, risk: size.lots * sd * pointValue, startIdx: j };
    return true;
  };

  const firstIdx = candles.findIndex((c) => c.t >= cfg.fromTs);
  if (firstIdx < 0) return { trades, skipped, finalBalance: balance, ruined, warnings: ["No candles in the selected period."] };

  for (let j = Math.max(1, firstIdx); j < candles.length && candles[j].t <= cfg.toTs && !ruined; j++) {
    const c = candles[j];

    // (a) scheduled exit at this bar's open
    let reverseTo: 1 | -1 | null = null;
    if (pos && pendingExit) {
      const p: Pos = pos;
      const px = p.dir === 1 ? c.o - half - slip : c.o + half + slip;
      if (pendingExit === "opposite") reverseTo = p.dir === 1 ? -1 : 1;
      close(j, px, pendingExit, c.t);
    }
    pendingExit = null;

    // (b) scheduled entry at this bar's open
    if (!pos && !ruined) {
      const want = reverseTo && ((reverseTo === 1 && longOn) || (reverseTo === -1 && shortOn)) ? { dir: reverseTo, sigIdx: j - 1 } : pendingEntry;
      if (want) open(j, want.dir, want.sigIdx);
    }
    pendingEntry = null;

    // (c) intrabar stop / target
    if (pos) {
      const p: Pos = pos;
      if (p.dir === 1) {
        if (c.l - half <= p.stop) close(j, Math.min(p.stop, c.o - half) - slip, "stop", c.t);
        else if (p.tp !== null && c.h - half >= p.tp) close(j, p.tp, "take_profit", c.t);
      } else {
        if (c.h + half >= p.stop) close(j, Math.max(p.stop, c.o + half) + slip, "stop", c.t);
        else if (p.tp !== null && c.l + half <= p.tp) close(j, p.tp, "take_profit", c.t);
      }
    }

    // (d) signals on this bar's close, executed next bar
    if (j < candles.length - 1 && candles[j + 1].t <= cfg.toTs && !ruined) {
      const lSig = longOn && allTrue(longEntry, j);
      const sSig = shortOn && allTrue(shortEntry, j);
      if (pos) {
        const p: Pos = pos;
        if (maxBars && j + 1 - p.startIdx >= maxBars) pendingExit = "max_bars";
        else if (p.dir === 1 && (allTrue(longExit, j) || (def.exitOnOpposite && sSig))) pendingExit = def.exitOnOpposite && sSig && !allTrue(longExit, j) ? "opposite" : "signal";
        else if (p.dir === -1 && (allTrue(shortExit, j) || (def.exitOnOpposite && lSig))) pendingExit = def.exitOnOpposite && lSig && !allTrue(shortExit, j) ? "opposite" : "signal";
      } else if (lSig && sSig) skipped.conflictingSignals++;
      else if ((lSig || sSig) && (!sessions || sessions.has(labSession(candles[j + 1].t)))) pendingEntry = { dir: lSig ? 1 : -1, sigIdx: j };
    }
  }

  if (pos) {
    const p: Pos = pos;
    let last = candles.length - 1;
    while (last > 0 && candles[last].t > cfg.toTs) last--;
    const lc = candles[last];
    close(last, p.dir === 1 ? lc.c - half - slip : lc.c + half + slip, "end_of_data", lc.t);
  }
  if (ruined) warnings.push("The simulated account balance reached zero; the test stopped.");
  if (skipped.belowMinLot > 0) warnings.push(`${skipped.belowMinLot} signals were skipped because the broker's minimum lot would risk more than your risk setting.`);
  if (skipped.conflictingSignals > 0) warnings.push(`${skipped.conflictingSignals} bars had both a long and a short signal and were ignored.`);
  return { trades, skipped, finalBalance: balance, ruined, warnings };
}

export type { Cond };
export { LAB_SESSIONS };
