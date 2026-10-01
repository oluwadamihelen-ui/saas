import { parseCsv, parseDateTime, parseNumber } from "@/lib/engine/csv-import";
import type { Candle } from "./types";

export const MAX_CANDLES = 60_000;
export const MAX_CANDLE_FILE_BYTES = 6 * 1024 * 1024;

const TF_MIN: Record<string, number> = { M1: 1, M5: 5, M15: 15, M30: 30, H1: 60, H4: 240, D1: 1440 };
export const TIMEFRAMES = Object.keys(TF_MIN);

export function timeframeFromCandles(c: Candle[]): string {
  if (c.length < 3) return "UNKNOWN";
  const deltas = c.slice(1, 200).map((x, i) => (x.t - c[i].t) / 60_000).filter((d) => d > 0).sort((a, b) => a - b);
  const median = deltas[Math.floor(deltas.length / 2)];
  const hit = Object.entries(TF_MIN).find(([, m]) => Math.abs(m - median) < 0.5);
  return hit ? hit[0] : "UNKNOWN";
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export interface CandleParse {
  candles: Candle[];
  error?: string;
  skipped: number;
  warnings: string[];
}

/**
 * Parses OHLCV CSVs: single datetime column (ISO, MT5 "2026.01.01 10:00", unix seconds/ms, TradingView) or
 * MT5's separate Date + Time columns. Sorts, de-duplicates and validates every candle.
 */
export function parseCandleCsv(text: string, utcOffsetHours = 0): CandleParse {
  const table = parseCsv(text);
  const warnings: string[] = [];
  if (table.length < 2) return { candles: [], error: "The file has no data rows.", skipped: 0, warnings };
  const hs = table[0].map(norm);
  const idx = (names: string[]) => hs.findIndex((h) => names.includes(h));
  const iDate = idx(["date", "datetime", "date time", "time", "timestamp", "open time"]);
  const iTime = hs.findIndex((h, i) => (h === "time" || h === "clock") && i !== iDate);
  const iO = idx(["open", "o"]), iH = idx(["high", "h"]), iL = idx(["low", "l"]), iC = idx(["close", "c", "last"]);
  const iV = idx(["volume", "tick volume", "tickvol", "vol", "v", "real volume"]);
  const missing = [["time", iDate], ["open", iO], ["high", iH], ["low", iL], ["close", iC]].filter(([, i]) => i === -1).map(([n]) => n);
  if (missing.length) return { candles: [], error: `Couldn't find these columns: ${missing.join(", ")}.`, skipped: 0, warnings };
  if (table.length - 1 > MAX_CANDLES * 1.2) return { candles: [], error: `Too many rows (max ${MAX_CANDLES.toLocaleString()} candles per dataset).`, skipped: 0, warnings };

  const parseTs = (row: string[]): number | null => {
    const raw = (row[iDate] ?? "").trim();
    if (/^\d{9,13}$/.test(raw)) { const n = Number(raw); return raw.length <= 10 ? n * 1000 : n; }
    const combined = iTime >= 0 && hs[iDate] === "date" ? `${raw} ${(row[iTime] ?? "").trim()}` : raw;
    return parseDateTime(combined, utcOffsetHours, false)?.getTime() ?? null;
  };

  const out: Candle[] = [];
  let skipped = 0;
  for (const row of table.slice(1)) {
    const t = parseTs(row);
    const o = parseNumber(row[iO]), h = parseNumber(row[iH]), l = parseNumber(row[iL]), c = parseNumber(row[iC]);
    const v = iV >= 0 ? parseNumber(row[iV]) ?? 0 : 0;
    if (t === null || o === null || h === null || l === null || c === null || o <= 0 || h <= 0 || l <= 0 || c <= 0 || h < l || h < Math.max(o, c) - 1e-9 || l > Math.min(o, c) + 1e-9) { skipped++; continue; }
    out.push({ t, o, h, l, c, v });
  }
  out.sort((a, b) => a.t - b.t);
  const dedup = out.filter((c, i) => i === 0 || c.t !== out[i - 1].t);
  if (dedup.length < out.length) warnings.push(`${out.length - dedup.length} duplicate timestamps removed.`);
  if (dedup.length < 50) return { candles: [], error: "Need at least 50 valid candles.", skipped, warnings };
  if (dedup.length > MAX_CANDLES) return { candles: [], error: `Too many candles (max ${MAX_CANDLES.toLocaleString()} per dataset).`, skipped, warnings };
  if (skipped) warnings.push(`${skipped} invalid rows were skipped.`);
  return { candles: dedup, skipped, warnings };
}

// ------------------------------------------------------------------ synthetic data (DEMO ONLY)

/**
 * Seeded random-walk candles for demos and tests. NOT real market data — results
 * on it are flagged synthetic everywhere and can never be used as marketplace evidence.
 */
export function generateSyntheticCandles(opts: { symbol: string; timeframe: string; days: number; startPrice: number; seed?: number; endTs?: number }): Candle[] {
  const mins = TF_MIN[opts.timeframe] ?? 60;
  const perDay = Math.floor(1440 / mins);
  const n = Math.min(MAX_CANDLES, Math.max(50, Math.round(opts.days * perDay)));
  let s = (opts.seed ?? 12345) >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const end = opts.endTs ?? Date.UTC(2026, 5, 30, 0, 0, 0);
  const start = end - n * mins * 60_000;
  const baseVol = opts.startPrice * 0.0009 * Math.sqrt(mins / 60);
  let price = opts.startPrice, regime = 1, drift = 0;
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const t = start + i * mins * 60_000;
    const hour = new Date(t).getUTCHours();
    const dow = new Date(t).getUTCDay();
    if (mins < 1440 && (dow === 6 || (dow === 0 && hour < 22) || (dow === 5 && hour >= 22))) continue; // weekend gap
    if (i % 40 === 0) { regime = 0.6 + rnd() * 1.4; drift = (rnd() - 0.5) * baseVol * 0.25; }
    const sessionVol = hour >= 13 && hour < 16 ? 1.5 : hour >= 7 && hour < 13 ? 1.2 : hour >= 16 && hour < 21 ? 1.1 : 0.7;
    const sigma = baseVol * regime * sessionVol;
    const o = price;
    const steps = 4;
    let hi = o, lo = o, p = o;
    for (let k = 0; k < steps; k++) { p += drift / steps + gauss() * sigma / Math.sqrt(steps); hi = Math.max(hi, p); lo = Math.min(lo, p); }
    const c = Math.max(p, opts.startPrice * 0.05);
    out.push({ t, o, h: Math.max(hi, o, c), l: Math.min(lo, o, c), c, v: Math.round(100 + rnd() * 900) });
    price = c;
  }
  return out;
}
