/** Performance report from simulated (or imported) trades. Neutral wording only. */
import { calculateDrawdown, calculateProfitFactor } from "@/lib/engine/risk";
import { LAB_SESSIONS, type SimTrade } from "./types";
import { labSession } from "./backtest";

export const REPORT_LABEL = "Historical backtest results — a simulation on past data. It does not predict or indicate future performance.";
export const OVERFIT_WARNING = "Parameter optimization can cause overfitting. Results may not generalize to future market conditions.";
export const SYNTHETIC_LABEL = "SYNTHETIC DEMO DATA — not real market prices. Not valid as evidence of any indicator's behaviour.";
export const SMALL_SAMPLE_TRADES = 30;

/** The minimal shape the report needs (SimTrade, or imported trades mapped into it). */
export type ReportTrade = Pick<SimTrade, "entryTime" | "exitTime" | "direction" | "pnl" | "rMultiple" | "riskAmount" | "barsHeld"> & { instrument?: string; session?: SimTrade["session"]; exitReason?: SimTrade["exitReason"] };

export interface Stats {
  trades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  netPnl: number;
  netPnlPercent: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number | null;
  largestLoss: number | null;
  profitFactor: number | null;
  avgR: number | null;
  totalR: number;
  maxDrawdownPercent: number;
  maxDrawdownAmount: number;
  maxWinStreak: number;
  maxLossStreak: number;
  longs: number;
  shorts: number;
  avgBarsHeld: number | null;
}

export function statsOf(trades: ReportTrade[], initialBalance: number): Stats {
  const ts = [...trades].sort((a, b) => a.exitTime - b.exitTime);
  const pnls = ts.map((t) => t.pnl);
  const wins = ts.filter((t) => t.pnl > 0), losses = ts.filter((t) => t.pnl < 0);
  let w = 0, l = 0, maxW = 0, maxL = 0;
  for (const t of ts) {
    if (t.pnl > 0) { w++; l = 0; } else if (t.pnl < 0) { l++; w = 0; } else { w = 0; l = 0; }
    maxW = Math.max(maxW, w); maxL = Math.max(maxL, l);
  }
  let bal = initialBalance;
  const eq = [bal, ...pnls.map((p) => (bal += p))];
  const dd = calculateDrawdown(eq);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const rs = ts.map((t) => t.rMultiple);
  return {
    trades: ts.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: ts.length - wins.length - losses.length,
    winRate: ts.length ? (wins.length / ts.length) * 100 : 0,
    netPnl: sum(pnls),
    netPnlPercent: initialBalance > 0 ? (sum(pnls) / initialBalance) * 100 : 0,
    avgWin: wins.length ? sum(wins.map((t) => t.pnl)) / wins.length : 0,
    avgLoss: losses.length ? sum(losses.map((t) => t.pnl)) / losses.length : 0,
    largestWin: wins.length ? Math.max(...wins.map((t) => t.pnl)) : null,
    largestLoss: losses.length ? Math.min(...losses.map((t) => t.pnl)) : null,
    profitFactor: calculateProfitFactor(pnls),
    avgR: rs.length ? sum(rs) / rs.length : null,
    totalR: sum(rs),
    maxDrawdownPercent: dd.maxDrawdownPercent,
    maxDrawdownAmount: dd.maxDrawdownAmount,
    maxWinStreak: maxW,
    maxLossStreak: maxL,
    longs: ts.filter((t) => t.direction === "LONG").length,
    shorts: ts.filter((t) => t.direction === "SHORT").length,
    avgBarsHeld: ts.length ? sum(ts.map((t) => t.barsHeld)) / ts.length : null,
  };
}

export interface GroupStats extends Stats { key: string }

export function groupStats(trades: ReportTrade[], initialBalance: number, keyOf: (t: ReportTrade) => string | null, order?: string[]): GroupStats[] {
  const m = new Map<string, ReportTrade[]>();
  for (const t of trades) {
    const k = keyOf(t);
    if (k === null) continue;
    (m.get(k) ?? m.set(k, []).get(k)!).push(t);
  }
  const rows = [...m.entries()].map(([key, ts]) => ({ key, ...statsOf(ts, initialBalance) }));
  if (order) rows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  else rows.sort((a, b) => a.key.localeCompare(b.key));
  return rows;
}

const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ORDER_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface Report {
  label: string;
  stats: Stats;
  equity: { i: number; t: number; equity: number }[];
  drawdown: { i: number; dd: number }[];
  monthly: GroupStats[];
  sessions: GroupStats[];
  hours: GroupStats[];
  weekdays: GroupStats[];
  directions: GroupStats[];
  instruments: GroupStats[];
  exits: Record<string, number>;
  smallSample: boolean;
  trades: { entryTime: number; exitTime: number; direction: string; entry?: number; exit?: number; lots?: number; pnl: number; r: number; reason?: string; session: string }[];
}

function downsample<T>(xs: T[], max: number): T[] {
  if (xs.length <= max) return xs;
  const step = xs.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(xs[Math.floor(i * step)]);
  out.push(xs[xs.length - 1]);
  return out;
}

export function buildReport(trades: (ReportTrade & Partial<SimTrade>)[], initialBalance: number, defaultInstrument = ""): Report {
  const ts = [...trades].sort((a, b) => a.exitTime - b.exitTime);
  let bal = initialBalance;
  const equity = [{ i: 0, t: ts[0]?.entryTime ?? 0, equity: bal }, ...ts.map((t, k) => ({ i: k + 1, t: t.exitTime, equity: (bal += t.pnl) }))];
  const dd = calculateDrawdown(equity.map((e) => e.equity));
  const sess = (t: ReportTrade) => t.session ?? labSession(t.entryTime);
  const exits: Record<string, number> = {};
  for (const t of ts) if (t.exitReason) exits[t.exitReason] = (exits[t.exitReason] ?? 0) + 1;
  const stats = statsOf(ts, initialBalance);
  return {
    label: REPORT_LABEL,
    stats,
    equity: downsample(equity, 400),
    drawdown: downsample(dd.series.map((d, i) => ({ i, dd: Number(d.toFixed(2)) })), 400),
    monthly: groupStats(ts, initialBalance, (t) => new Date(t.entryTime).toISOString().slice(0, 7)),
    sessions: groupStats(ts, initialBalance, sess, [...LAB_SESSIONS]),
    hours: groupStats(ts, initialBalance, (t) => String(new Date(t.entryTime).getUTCHours()).padStart(2, "0")),
    weekdays: groupStats(ts, initialBalance, (t) => WEEK[new Date(t.entryTime).getUTCDay()], ORDER_WEEK),
    directions: groupStats(ts, initialBalance, (t) => (t.direction === "LONG" ? "Long" : "Short")),
    instruments: groupStats(ts, initialBalance, (t) => t.instrument ?? (defaultInstrument || "—")),
    exits,
    smallSample: stats.trades < SMALL_SAMPLE_TRADES,
    trades: ts.slice(0, 2000).map((t) => ({ entryTime: t.entryTime, exitTime: t.exitTime, direction: t.direction, entry: t.entry, exit: t.exit, lots: t.lots, pnl: t.pnl, r: t.rMultiple, reason: t.exitReason, session: sess(t) })),
  };
}
