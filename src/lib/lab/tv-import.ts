import { parseCsv, parseDateTime, parseNumber } from "@/lib/engine/csv-import";
import type { ReportTrade } from "./report";

/**
 * Imports a TradingView Strategy Tester "List of trades" CSV (rows come in Entry/Exit pairs).
 * RiskPilot does not run the Pine strategy, so these results are NOT verified by the platform:
 * they are labelled "Imported" everywhere. R multiples assume a fixed risk per trade the user states.
 */
export interface TvImportOptions {
  initialBalance: number;
  assumedRiskPercent: number;
  utcOffsetHours: number;
}

export function parseTradingViewTrades(text: string, o: TvImportOptions): { trades: ReportTrade[]; error?: string; skipped: number } {
  const table = parseCsv(text);
  if (table.length < 3) return { trades: [], error: "The file has no trades.", skipped: 0 };
  const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();
  const hs = table[0].map(norm);
  const find = (pred: (h: string) => boolean) => hs.findIndex(pred);
  const iNo = find((h) => h === "trade" || h === "trade #" || h === "trade no");
  const iType = find((h) => h === "type");
  const iTime = find((h) => h.startsWith("date") || h === "time");
  const iPrice = find((h) => h.startsWith("price"));
  const iProfit = find((h) => (h.startsWith("profit") || h.startsWith("net p l") || h.startsWith("p l")) && !h.includes("%") && !h.includes("cumulative"));
  if ([iNo, iType, iTime, iProfit].includes(-1)) return { trades: [], error: "This doesn't look like a TradingView \"List of trades\" export (need Trade #, Type, Date/Time and Profit columns).", skipped: 0 };

  const byTrade = new Map<string, { entry?: { t: number; p: number | null; dir: "LONG" | "SHORT" }; exit?: { t: number; p: number | null; pnl: number | null } }>();
  for (const row of table.slice(1)) {
    const no = (row[iNo] ?? "").trim();
    const type = (row[iType] ?? "").trim().toLowerCase();
    const t = parseDateTime(row[iTime], o.utcOffsetHours, false)?.getTime();
    if (!no || !type || t === undefined) continue;
    const slot = byTrade.get(no) ?? {};
    const price = iPrice >= 0 ? parseNumber(row[iPrice]) : null;
    if (type.startsWith("entry")) slot.entry = { t, p: price, dir: type.includes("short") ? "SHORT" : "LONG" };
    else if (type.startsWith("exit") || type.startsWith("close")) slot.exit = { t, p: price, pnl: parseNumber(row[iProfit]) };
    byTrade.set(no, slot);
  }
  const risk = (o.initialBalance * o.assumedRiskPercent) / 100;
  const trades: ReportTrade[] = [];
  let skipped = 0;
  for (const s of byTrade.values()) {
    if (!s.entry || !s.exit || s.exit.pnl === null) { skipped++; continue; }
    trades.push({
      entryTime: s.entry.t, exitTime: s.exit.t, direction: s.entry.dir,
      pnl: s.exit.pnl, riskAmount: risk, rMultiple: risk > 0 ? s.exit.pnl / risk : 0,
      barsHeld: 0,
    });
  }
  trades.sort((a, b) => a.exitTime - b.exitTime);
  if (!trades.length) return { trades: [], error: "No complete entry/exit pairs found.", skipped };
  return { trades, skipped };
}
