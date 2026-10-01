import { runBacktest } from "./backtest";
import { buildReport, statsOf, type Report, type Stats } from "./report";
import type { BacktestConfig, Candle, StrategyDef } from "./types";

export const MAX_COMBINATIONS = 60;
export const MAX_VALUES_PER_PARAM = 20;

/** Parses "20, 50, 100" or "10-30:10" (start-end:step) into a list of numbers. */
export function parseValues(text: string): number[] {
  const t = text.trim();
  if (!t) return [];
  const range = t.match(/^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
  let out: number[];
  if (range) {
    const [a, b, s] = [Number(range[1]), Number(range[2]), Number(range[3])];
    if (!(s > 0) || b < a) throw new Error(`Invalid range "${t}".`);
    out = [];
    for (let v = a; v <= b + 1e-9; v += s) out.push(Number(v.toFixed(8)));
  } else {
    out = t.split(/[,\s]+/).filter(Boolean).map(Number);
    if (out.some((n) => !Number.isFinite(n))) throw new Error(`"${t}" contains something that isn't a number.`);
  }
  if (out.length > MAX_VALUES_PER_PARAM) throw new Error(`Use at most ${MAX_VALUES_PER_PARAM} values per parameter.`);
  return [...new Set(out)];
}

export interface ParamGrid { name: string; values: number[] }

export function expandGrid(grid: ParamGrid[]): Record<string, number>[] {
  const active = grid.filter((g) => g.values.length > 0);
  if (!active.length) throw new Error("Add at least one parameter with values to test.");
  const total = active.reduce((a, g) => a * g.values.length, 1);
  if (total > MAX_COMBINATIONS) throw new Error(`That is ${total} combinations; the limit is ${MAX_COMBINATIONS}. Use fewer values.`);
  let combos: Record<string, number>[] = [{}];
  for (const g of active) combos = combos.flatMap((c) => g.values.map((v) => ({ ...c, [g.name]: v })));
  return combos;
}

export interface OptimizationRow { params: Record<string, number>; stats: Stats; error?: string }

/**
 * Runs every combination and returns the statistics objectively. Nothing is ranked or
 * labelled "best" — the user decides which characteristics matter.
 */
export function runOptimization(candles: Candle[], def: StrategyDef, cfg: BacktestConfig, grid: ParamGrid[]): OptimizationRow[] {
  return expandGrid(grid).map((params) => {
    try {
      const r = runBacktest(candles, def, { ...cfg, params: { ...cfg.params, ...params } });
      return { params, stats: statsOf(r.trades, cfg.initialBalance) };
    } catch (e) {
      return { params, stats: statsOf([], cfg.initialBalance), error: e instanceof Error ? e.message : "Failed" };
    }
  });
}

export interface WalkForwardResult {
  params: Record<string, number>;
  splitTs: number;
  inSample: { fromTs: number; toTs: number; report: Report };
  outOfSample: { fromTs: number; toTs: number; report: Report };
}

/**
 * The same fixed parameters are applied to two separate periods: the optimization (in-sample)
 * period and a later out-of-sample period. Indicators warm up on earlier data, but no trade
 * can be opened in the other period.
 */
export function walkForward(candles: Candle[], def: StrategyDef, cfg: BacktestConfig, splitTs: number, params: Record<string, number>): WalkForwardResult {
  if (!(splitTs > cfg.fromTs && splitTs < cfg.toTs)) throw new Error("The split date must fall inside the tested period.");
  const run = (fromTs: number, toTs: number) => {
    const c = { ...cfg, fromTs, toTs, params: { ...cfg.params, ...params } };
    return { fromTs, toTs, report: buildReport(runBacktest(candles, def, c).trades, cfg.initialBalance, cfg.symbol) };
  };
  return { params, splitTs, inSample: run(cfg.fromTs, splitTs - 1), outOfSample: run(splitTs, cfg.toTs) };
}
