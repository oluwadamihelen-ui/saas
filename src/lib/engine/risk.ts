/**
 * RiskPilot calculation engine — pure functions, no React, no I/O.
 *
 * Core formula (works for any instrument that has a tick specification):
 *
 *   riskAmount   = balance × riskPercent / 100
 *   stopDistance = |entry − stopLoss|                        (price units)
 *   lossPerLot   = (stopDistance / tickSize) × tickValue × fxRate
 *   lots         = riskAmount / lossPerLot, rounded DOWN to the lot step
 *
 * `tickValue` is the profit/loss of ONE tick on ONE lot, expressed in the
 * instrument's quote currency; `fxRate` converts quote currency → account
 * currency (1 when they are the same). These specifications differ between
 * brokers, so every result is tagged "estimated" unless the user confirmed the
 * specification with their broker.
 *
 * Low-level helpers throw `RiskInputError` on invalid input so a bad number can
 * never silently turn into a dangerous position size. `computePositionSize`
 * and `computeRisk` are the safe, non-throwing wrappers the UI uses.
 */

export class RiskInputError extends Error {
  constructor(message: string, readonly field?: string) {
    super(message);
    this.name = "RiskInputError";
  }
}

export type Direction = "LONG" | "SHORT";

export interface InstrumentSpec {
  symbol: string;
  /** Units of the underlying per 1 lot (informational; tickValue drives maths). */
  contractSize: number;
  /** Smallest price increment. */
  tickSize: number;
  /** P/L of one tick on one lot, in quote currency. */
  tickValue: number;
  minLot: number;
  maxLot: number;
  lotStep: number;
  /** Currency tickValue is expressed in. */
  quoteCurrency: string;
}

export type SpecStatus = "estimated" | "confirmed";

const EPS = 1e-9;

function assertFinitePositive(value: number, field: string, label = field) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RiskInputError(`${label} must be a number`, field);
  }
  if (value <= 0) throw new RiskInputError(`${label} must be greater than zero`, field);
}

export function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

export function decimalsOf(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 2;
  const s = step.toString();
  if (s.includes("e-")) return Number(s.split("e-")[1]);
  const [, frac = ""] = s.split(".");
  return frac.length;
}

// ---------------------------------------------------------------- basics

export function calculateRiskPercentage(riskAmount: number, balance: number): number {
  assertFinitePositive(balance, "balance", "Account balance");
  if (!Number.isFinite(riskAmount) || riskAmount < 0) {
    throw new RiskInputError("Risk amount must be zero or more", "riskAmount");
  }
  return (riskAmount / balance) * 100;
}

export function calculateRiskAmount(balance: number, riskPercent: number): number {
  assertFinitePositive(balance, "balance", "Account balance");
  if (!Number.isFinite(riskPercent) || riskPercent <= 0) {
    throw new RiskInputError("Risk % must be greater than zero", "riskPercent");
  }
  if (riskPercent > 100) throw new RiskInputError("Risk % cannot be above 100", "riskPercent");
  return (balance * riskPercent) / 100;
}

export function calculateStopDistance(entry: number, stopLoss: number): number {
  assertFinitePositive(entry, "entry", "Entry price");
  assertFinitePositive(stopLoss, "stopLoss", "Stop-loss price");
  const d = Math.abs(entry - stopLoss);
  if (d < EPS) throw new RiskInputError("Stop loss cannot equal entry", "stopLoss");
  return d;
}

export function directionFromPrices(entry: number, stopLoss: number): Direction {
  return stopLoss < entry ? "LONG" : "SHORT";
}

function assertSpec(spec: InstrumentSpec) {
  assertFinitePositive(spec.contractSize, "contractSize", "Contract size");
  assertFinitePositive(spec.tickSize, "tickSize", "Tick size");
  assertFinitePositive(spec.tickValue, "tickValue", "Tick value");
  assertFinitePositive(spec.minLot, "minLot", "Minimum lot");
  assertFinitePositive(spec.maxLot, "maxLot", "Maximum lot");
  assertFinitePositive(spec.lotStep, "lotStep", "Lot step");
  if (spec.maxLot < spec.minLot) {
    throw new RiskInputError("Maximum lot must be at least the minimum lot", "maxLot");
  }
}

/** Money lost (in account currency) if price moves `priceDistance` against 1 lot. */
export function calculateLossPerLot(spec: InstrumentSpec, priceDistance: number, fxRate = 1): number {
  assertSpec(spec);
  assertFinitePositive(priceDistance, "priceDistance", "Price distance");
  assertFinitePositive(fxRate, "fxRate", "Exchange rate");
  return (priceDistance / spec.tickSize) * spec.tickValue * fxRate;
}

export type SizeStatus = "ok" | "below_min_lot" | "above_max_lot";

export interface PositionSize {
  /** Unrounded lots that would risk exactly riskAmount. */
  rawLots: number;
  /** Final lots (0 when the minimum lot would already exceed the risk budget). */
  lots: number;
  status: SizeStatus;
  /** Money actually at risk with `lots`. */
  actualRisk: number;
  /** Money at risk if the trader used the broker's minimum lot (shown when below_min_lot). */
  riskAtMinLot: number;
}

export function calculatePositionSize(
  riskAmount: number,
  lossPerLot: number,
  spec: Pick<InstrumentSpec, "minLot" | "maxLot" | "lotStep">,
): PositionSize {
  assertFinitePositive(riskAmount, "riskAmount", "Risk amount");
  assertFinitePositive(lossPerLot, "lossPerLot", "Loss per lot");
  assertFinitePositive(spec.minLot, "minLot", "Minimum lot");
  assertFinitePositive(spec.maxLot, "maxLot", "Maximum lot");
  assertFinitePositive(spec.lotStep, "lotStep", "Lot step");
  if (spec.maxLot < spec.minLot) throw new RiskInputError("Maximum lot must be at least the minimum lot", "maxLot");

  const rawLots = riskAmount / lossPerLot;
  const dec = Math.max(decimalsOf(spec.lotStep), decimalsOf(spec.minLot));
  const riskAtMinLot = spec.minLot * lossPerLot;

  if (rawLots + EPS < spec.minLot) {
    return { rawLots, lots: 0, status: "below_min_lot", actualRisk: 0, riskAtMinLot };
  }

  // Step grid starts at minLot. Always round DOWN so risk never exceeds the budget.
  const steps = Math.floor((rawLots - spec.minLot) / spec.lotStep + 1e-7);
  let lots = roundTo(spec.minLot + steps * spec.lotStep, dec);
  let status: SizeStatus = "ok";
  if (lots > spec.maxLot + EPS) {
    const maxSteps = Math.floor((spec.maxLot - spec.minLot) / spec.lotStep + 1e-7);
    lots = roundTo(spec.minLot + maxSteps * spec.lotStep, dec);
    status = "above_max_lot";
  }
  return { rawLots, lots, status, actualRisk: lots * lossPerLot, riskAtMinLot };
}

export function calculatePotentialLoss(lots: number, lossPerLot: number): number {
  if (!Number.isFinite(lots) || lots < 0) throw new RiskInputError("Position size must be zero or more", "lots");
  assertFinitePositive(lossPerLot, "lossPerLot", "Loss per lot");
  return lots * lossPerLot;
}

export function calculatePotentialProfit(
  lots: number,
  entry: number,
  takeProfit: number,
  spec: InstrumentSpec,
  fxRate = 1,
): number {
  if (!Number.isFinite(lots) || lots < 0) throw new RiskInputError("Position size must be zero or more", "lots");
  const dist = calculateStopDistance(entry, takeProfit); // same validation, TP != entry
  return lots * calculateLossPerLot(spec, dist, fxRate);
}

export function calculateRiskReward(entry: number, stopLoss: number, takeProfit: number): number {
  const risk = calculateStopDistance(entry, stopLoss);
  const reward = calculateStopDistance(entry, takeProfit);
  return reward / risk;
}

// ---------------------------------------------------------------- risk bands

export interface RiskBands {
  lowMax: number;
  moderateMax: number;
  highMax: number;
}
export const DEFAULT_BANDS: RiskBands = { lowMax: 1, moderateMax: 2, highMax: 5 };
export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "EXTREME";

export function classifyRisk(riskPercent: number, bands: RiskBands = DEFAULT_BANDS): RiskLevel {
  if (!Number.isFinite(riskPercent) || riskPercent < 0) throw new RiskInputError("Invalid risk %", "riskPercent");
  if (riskPercent <= bands.lowMax) return "LOW";
  if (riskPercent <= bands.moderateMax) return "MODERATE";
  if (riskPercent <= bands.highMax) return "HIGH";
  return "EXTREME";
}

// ---------------------------------------------------------------- safe wrappers

export interface SizeInput {
  balance: number;
  riskPercent: number;
  entry: number;
  stopLoss: number;
  takeProfit?: number | null;
  spec: InstrumentSpec;
  /** quote currency → account currency */
  fxRate?: number;
  specConfirmed?: boolean;
  /** Maximum risk the user allows per trade (their own rule); adds a warning if exceeded. */
  maxRiskPerTrade?: number;
  bands?: RiskBands;
}

export interface SizeResult {
  ok: true;
  direction: Direction;
  specStatus: SpecStatus;
  riskAmount: number;
  stopDistance: number;
  lossPerLot: number;
  size: PositionSize;
  /** Risk actually taken with the final lot size */
  actualRisk: number;
  actualRiskPercent: number;
  level: RiskLevel;
  potentialLoss: number;
  potentialProfit: number | null;
  riskReward: number | null;
  warnings: string[];
}
export interface CalcFailure {
  ok: false;
  errors: { field?: string; message: string }[];
}

function fail(e: unknown): CalcFailure {
  if (e instanceof RiskInputError) return { ok: false, errors: [{ field: e.field, message: e.message }] };
  throw e;
}

export function computePositionSize(input: SizeInput): SizeResult | CalcFailure {
  try {
    const fx = input.fxRate ?? 1;
    const riskAmount = calculateRiskAmount(input.balance, input.riskPercent);
    const stopDistance = calculateStopDistance(input.entry, input.stopLoss);
    const lossPerLot = calculateLossPerLot(input.spec, stopDistance, fx);
    const size = calculatePositionSize(riskAmount, lossPerLot, input.spec);
    const direction = directionFromPrices(input.entry, input.stopLoss);
    const warnings: string[] = [];

    if (size.status === "below_min_lot") {
      const pct = (size.riskAtMinLot / input.balance) * 100;
      warnings.push(
        `Your risk budget is too small for this stop distance: the broker's minimum lot (${input.spec.minLot}) would risk ${pct.toFixed(2)}% of your account. Consider a smaller stop, a different instrument, or skip the trade.`,
      );
    }
    if (size.status === "above_max_lot") {
      warnings.push(`Size capped at the broker's maximum lot (${input.spec.maxLot}); your risk will be lower than planned.`);
    }
    if (input.maxRiskPerTrade !== undefined && input.riskPercent > input.maxRiskPerTrade + EPS) {
      warnings.push(`This is above your own max risk per trade (${input.maxRiskPerTrade}%).`);
    }
    if (input.riskPercent > 5) warnings.push("Risking more than 5% on one trade can end an account quickly.");

    let potentialProfit: number | null = null;
    let riskReward: number | null = null;
    const tp = input.takeProfit;
    if (tp !== undefined && tp !== null && Number.isFinite(tp) && tp !== 0) {
      const tpOnCorrectSide = direction === "LONG" ? tp > input.entry : tp < input.entry;
      if (!tpOnCorrectSide) {
        warnings.push("Take-profit is on the same side as your stop loss — check your prices.");
      } else {
        potentialProfit = calculatePotentialProfit(size.lots, input.entry, tp, input.spec, fx);
        riskReward = calculateRiskReward(input.entry, input.stopLoss, tp);
      }
    }

    const actualRisk = size.actualRisk;
    return {
      ok: true,
      direction,
      specStatus: input.specConfirmed ? "confirmed" : "estimated",
      riskAmount,
      stopDistance,
      lossPerLot,
      size,
      actualRisk,
      actualRiskPercent: (actualRisk / input.balance) * 100,
      level: classifyRisk(input.riskPercent, input.bands),
      potentialLoss: actualRisk,
      potentialProfit,
      riskReward,
      warnings,
    };
  } catch (e) {
    return fail(e);
  }
}

export interface RiskInput {
  balance: number;
  entry: number;
  stopLoss: number;
  takeProfit?: number | null;
  lots: number;
  spec: InstrumentSpec;
  fxRate?: number;
  specConfirmed?: boolean;
  bands?: RiskBands;
}
export interface RiskResult {
  ok: true;
  direction: Direction;
  specStatus: SpecStatus;
  stopDistance: number;
  riskAmount: number;
  riskPercent: number;
  level: RiskLevel;
  potentialLoss: number;
  potentialProfit: number | null;
  riskReward: number | null;
  warnings: string[];
}

/** "I already know my lot size — how much am I risking?" */
export function computeRisk(input: RiskInput): RiskResult | CalcFailure {
  try {
    const fx = input.fxRate ?? 1;
    assertFinitePositive(input.balance, "balance", "Account balance");
    assertFinitePositive(input.lots, "lots", "Position size");
    const stopDistance = calculateStopDistance(input.entry, input.stopLoss);
    const lossPerLot = calculateLossPerLot(input.spec, stopDistance, fx);
    const riskAmount = calculatePotentialLoss(input.lots, lossPerLot);
    const riskPercent = calculateRiskPercentage(riskAmount, input.balance);
    const direction = directionFromPrices(input.entry, input.stopLoss);
    const warnings: string[] = [];
    if (input.lots < input.spec.minLot - EPS) warnings.push(`Below the minimum lot (${input.spec.minLot}).`);
    if (input.lots > input.spec.maxLot + EPS) warnings.push(`Above the maximum lot (${input.spec.maxLot}).`);
    const stepsFromMin = (input.lots - input.spec.minLot) / input.spec.lotStep;
    if (Math.abs(stepsFromMin - Math.round(stepsFromMin)) > 1e-6) {
      warnings.push(`Position size doesn't match the lot step (${input.spec.lotStep}); your broker may reject or round it.`);
    }
    if (riskPercent > 100) warnings.push("This trade could lose more than your whole account balance.");

    let potentialProfit: number | null = null;
    let riskReward: number | null = null;
    const tp = input.takeProfit;
    if (tp !== undefined && tp !== null && Number.isFinite(tp) && tp !== 0) {
      const ok = direction === "LONG" ? tp > input.entry : tp < input.entry;
      if (!ok) warnings.push("Take-profit is on the same side as your stop loss — check your prices.");
      else {
        potentialProfit = calculatePotentialProfit(input.lots, input.entry, tp, input.spec, fx);
        riskReward = calculateRiskReward(input.entry, input.stopLoss, tp);
      }
    }
    return {
      ok: true,
      direction,
      specStatus: input.specConfirmed ? "confirmed" : "estimated",
      stopDistance,
      riskAmount,
      riskPercent,
      level: classifyRisk(riskPercent, input.bands),
      potentialLoss: riskAmount,
      potentialProfit,
      riskReward,
      warnings,
    };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- performance maths

export function calculateRMultiple(pnl: number, riskAmount: number): number | null {
  if (!Number.isFinite(pnl) || !Number.isFinite(riskAmount) || riskAmount <= 0) return null;
  return pnl / riskAmount;
}

export interface DrawdownResult {
  maxDrawdownAmount: number;
  /** Largest peak-to-trough fall as % of the peak (0–100). */
  maxDrawdownPercent: number;
  currentDrawdownPercent: number;
  /** Drawdown % at every point (≤ 0), aligned with the input series. */
  series: number[];
}

/** `equity` is the account balance after each trade, including the starting balance as the first point. */
export function calculateDrawdown(equity: number[]): DrawdownResult {
  let peak = -Infinity;
  let maxAmt = 0;
  let maxPct = 0;
  const series: number[] = [];
  let curPct = 0;
  for (const v of equity) {
    if (!Number.isFinite(v)) throw new RiskInputError("Equity contains an invalid value", "equity");
    if (v > peak) peak = v;
    const dd = peak - v;
    const pct = peak > 0 ? (dd / peak) * 100 : 0;
    if (dd > maxAmt) maxAmt = dd;
    if (pct > maxPct) maxPct = pct;
    curPct = pct;
    series.push(-pct);
  }
  return { maxDrawdownAmount: maxAmt, maxDrawdownPercent: maxPct, currentDrawdownPercent: curPct, series };
}

/** Average R multiple per trade. Returns null with no trades. */
export function calculateExpectancy(rMultiples: number[]): number | null {
  const rs = rMultiples.filter(Number.isFinite);
  if (!rs.length) return null;
  return rs.reduce((a, b) => a + b, 0) / rs.length;
}

/** Gross profit ÷ gross loss. Infinity when there are wins and no losses; null when no wins or losses. */
export function calculateProfitFactor(pnls: number[]): number | null {
  let win = 0;
  let loss = 0;
  for (const p of pnls) {
    if (!Number.isFinite(p)) continue;
    if (p > 0) win += p;
    else if (p < 0) loss += -p;
  }
  if (loss === 0) return win > 0 ? Infinity : null;
  return win / loss;
}
