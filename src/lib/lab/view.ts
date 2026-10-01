import "server-only";
import { prisma } from "@/lib/db";
import type { StrategyDef } from "./types";
import { collectParams } from "./backtest";

export async function datasetsLite(userId: string) {
  const ds = await prisma.dataset.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, symbol: true, timeframe: true, fromTs: true, toTs: true, source: true } });
  return ds.map((d) => ({ id: d.id, name: d.name, symbol: d.symbol, timeframe: d.timeframe, fromDate: d.fromTs.toISOString().slice(0, 10), toDate: d.toTs.toISOString().slice(0, 10), synthetic: d.source === "SYNTHETIC" }));
}

export function paramList(def: StrategyDef, overrides: Record<string, number> = {}) {
  return collectParams(def).map((name) => ({ name, value: overrides[name] ?? def.defaults?.[name] ?? 0 }));
}

/** ?p_fast=20 → { fast: 20 } */
export function overridesFrom(sp: Record<string, string | string[] | undefined>) {
  const o: Record<string, number> = {};
  for (const [k, v] of Object.entries(sp)) if (k.startsWith("p_") && typeof v === "string" && Number.isFinite(Number(v))) o[k.slice(2)] = Number(v);
  return o;
}
