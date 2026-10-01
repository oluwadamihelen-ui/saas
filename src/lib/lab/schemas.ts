import { z } from "zod";
import { LAB_SESSIONS, type StrategyDef } from "./types";

const paramName = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,30}$/);
const num = z.union([z.number().finite(), z.object({ param: paramName })]);
const priceField = z.enum(["open", "high", "low", "close"]);

const operand = z.discriminatedUnion("k", [
  z.object({ k: z.literal("price"), f: priceField }),
  z.object({ k: z.literal("ind"), name: z.enum(["sma", "ema", "rsi", "atr", "highest", "lowest"]), period: num, src: priceField.optional() }),
  z.object({ k: z.literal("num"), v: num }),
]);

const cond = z.object({ l: operand, op: z.enum(["crosses_above", "crosses_below", "gt", "lt", "gte", "lte"]), r: operand });
const conds = z.array(cond).max(6);

export const strategyDefSchema = z.object({
  direction: z.enum(["both", "long", "short"]),
  longEntry: conds,
  shortEntry: conds,
  longExit: conds,
  shortExit: conds,
  exitOnOpposite: z.boolean(),
  maxBarsInTrade: z.number().int().positive().max(100_000).nullable(),
  stop: z.object({ type: z.enum(["pips", "distance", "atr", "percent"]), value: num, atrPeriod: num.optional() }),
  target: z.object({ type: z.enum(["none", "rr", "pips", "distance", "atr", "percent"]), value: num, atrPeriod: num.optional() }),
  sessions: z.array(z.enum(LAB_SESSIONS)).nullable(),
  defaults: z.record(paramName, z.number().finite()).optional(),
}) satisfies z.ZodType<StrategyDef>;

export function parseStrategyDef(raw: unknown): { ok: true; def: StrategyDef } | { ok: false; error: string } {
  const r = strategyDefSchema.safeParse(raw);
  return r.success ? { ok: true, def: r.data as StrategyDef } : { ok: false, error: `Invalid strategy: ${r.error.issues[0]?.path.join(".") || "definition"} — ${r.error.issues[0]?.message}` };
}

export const VERSION_RE = /^\d{1,3}\.\d{1,3}(\.\d{1,3})?$/;

/** Compares "1.10" > "1.9" numerically. */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/i, "").split(".").map(Number), pb = b.replace(/^v/i, "").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export const MARKETS = ["XAUUSD", "XAGUSD", "BTCUSD", "ETHUSD", "EURUSD", "GBPUSD", "USDJPY", "US30", "NAS100"];
export const LAB_TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1"];
