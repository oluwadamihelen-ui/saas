import type { Candle, Cond, IndicatorName, Num, Operand, PriceField } from "./types";

/** Built-in indicator maths used by the rule-based backtester. NaN marks warm-up bars. */

export function field(candles: Candle[], f: PriceField): number[] {
  const key = f === "open" ? "o" : f === "high" ? "h" : f === "low" ? "l" : "c";
  return candles.map((c) => c[key]);
}

export function sma(values: number[], n: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  if (n < 1) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= n) sum -= values[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

/** EMA seeded with the SMA of the first n values (the usual convention). */
export function ema(values: number[], n: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  if (n < 1 || values.length < n) return out;
  const k = 2 / (n + 1);
  let prev = values.slice(0, n).reduce((a, b) => a + b, 0) / n;
  out[n - 1] = prev;
  for (let i = n; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Wilder's RSI. */
export function rsi(values: number[], n: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  if (n < 1 || values.length <= n) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  gain /= n;
  loss /= n;
  const val = (g: number, l: number) => (l === 0 ? (g === 0 ? 50 : 100) : 100 - 100 / (1 + g / l));
  out[n] = val(gain, loss);
  for (let i = n + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
    out[i] = val(gain, loss);
  }
  return out;
}

/** Wilder's ATR. */
export function atr(candles: Candle[], n: number): number[] {
  const out = new Array<number>(candles.length).fill(NaN);
  if (n < 1 || candles.length <= n) return out;
  const tr = candles.map((c, i) => (i === 0 ? c.h - c.l : Math.max(c.h - c.l, Math.abs(c.h - candles[i - 1].c), Math.abs(c.l - candles[i - 1].c))));
  let prev = tr.slice(1, n + 1).reduce((a, b) => a + b, 0) / n;
  out[n] = prev;
  for (let i = n + 1; i < candles.length; i++) {
    prev = (prev * (n - 1) + tr[i]) / n;
    out[i] = prev;
  }
  return out;
}

/** Highest value of the PREVIOUS n bars (excludes the current bar, so a breakout of it is possible). */
export function highest(values: number[], n: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  for (let i = n; i < values.length; i++) {
    let m = -Infinity;
    for (let j = i - n; j < i; j++) if (values[j] > m) m = values[j];
    out[i] = m;
  }
  return out;
}

export function lowest(values: number[], n: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  for (let i = n; i < values.length; i++) {
    let m = Infinity;
    for (let j = i - n; j < i; j++) if (values[j] < m) m = values[j];
    out[i] = m;
  }
  return out;
}

// ------------------------------------------------------------------ operand resolution

export function resolveNum(n: Num, params: Record<string, number> | undefined): number {
  if (typeof n === "number") return n;
  const v = params?.[n.param];
  if (v === undefined || !Number.isFinite(v)) throw new Error(`Parameter "${n.param}" has no value`);
  return v;
}

export type Series = number[];

/** Computes the series for an operand once; callers cache by key. */
export function operandSeries(op: Operand, candles: Candle[], params: Record<string, number> | undefined, cache: Map<string, Series>): Series {
  if (op.k === "price") return field(candles, op.f);
  if (op.k === "num") return new Array<number>(candles.length).fill(resolveNum(op.v, params));
  const period = Math.round(resolveNum(op.period, params));
  if (!(period >= 1 && period <= 1000)) throw new Error(`Indicator period must be between 1 and 1000 (got ${period})`);
  const src = op.src ?? "close";
  const key = `${op.name}:${period}:${src}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const values = field(candles, src);
  const fns: Record<IndicatorName, () => Series> = {
    sma: () => sma(values, period),
    ema: () => ema(values, period),
    rsi: () => rsi(values, period),
    atr: () => atr(candles, period),
    highest: () => highest(field(candles, op.src ?? "high"), period),
    lowest: () => lowest(field(candles, op.src ?? "low"), period),
  };
  const s = fns[op.name]();
  cache.set(key, s);
  return s;
}

export interface CompiledCond {
  l: Series;
  r: Series;
  op: Cond["op"];
}

export function compileConds(conds: Cond[], candles: Candle[], params: Record<string, number> | undefined, cache: Map<string, Series>): CompiledCond[] {
  return conds.map((c) => ({ l: operandSeries(c.l, candles, params, cache), r: operandSeries(c.r, candles, params, cache), op: c.op }));
}

/** All conditions true on bar i (values taken at bar close). Any NaN → false. Needs i ≥ 1 for crosses. */
export function allTrue(conds: CompiledCond[], i: number): boolean {
  if (conds.length === 0) return false;
  for (const c of conds) {
    const l = c.l[i], r = c.r[i];
    if (!Number.isFinite(l) || !Number.isFinite(r)) return false;
    switch (c.op) {
      case "gt": if (!(l > r)) return false; break;
      case "gte": if (!(l >= r)) return false; break;
      case "lt": if (!(l < r)) return false; break;
      case "lte": if (!(l <= r)) return false; break;
      case "crosses_above": {
        if (i < 1) return false;
        const pl = c.l[i - 1], pr = c.r[i - 1];
        if (!Number.isFinite(pl) || !Number.isFinite(pr) || !(pl <= pr && l > r)) return false;
        break;
      }
      case "crosses_below": {
        if (i < 1) return false;
        const pl = c.l[i - 1], pr = c.r[i - 1];
        if (!Number.isFinite(pl) || !Number.isFinite(pr) || !(pl >= pr && l < r)) return false;
        break;
      }
    }
  }
  return true;
}
