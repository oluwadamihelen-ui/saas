import {
  calculateDrawdown,
  calculateExpectancy,
  calculateProfitFactor,
} from "./risk";
import { DEFAULT_TZ, WEEKDAYS, dayKey, monthKey, weekdayName } from "./time";

/** The minimal trade shape analytics needs (decoupled from Prisma). */
export interface AnalyticsTrade {
  id: string;
  openedAt: Date;
  instrument: string;
  direction: "LONG" | "SHORT";
  result: "OPEN" | "WIN" | "LOSS" | "BREAKEVEN";
  pnl: number | null;
  rMultiple: number | null;
  riskPercent: number;
  riskAmount: number;
  setup?: string | null;
  session?: string | null;
  checklistScore?: number | null;
  emotionBefore?: string | null;
}

export const isClosed = (t: AnalyticsTrade) => t.result !== "OPEN" && t.pnl !== null;

export interface Summary {
  trades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  lossRate: number;
  totalPnl: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number | null;
  avgR: number | null;
  expectancyR: number | null;
  avgRisk: number | null;
  avgRiskWins: number | null;
  avgRiskLosses: number | null;
  best: number | null;
  worst: number | null;
  maxWinStreak: number;
  maxLossStreak: number;
  currentStreak: { type: "WIN" | "LOSS" | "NONE"; length: number };
  maxDrawdownPercent: number;
  maxDrawdownAmount: number;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function sorted(trades: AnalyticsTrade[]) {
  return trades.filter(isClosed).sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime());
}

export function equityPoints(trades: AnalyticsTrade[], startingBalance: number, tz = DEFAULT_TZ) {
  const closed = sorted(trades);
  let bal = startingBalance;
  const pts = [{ label: "Start", date: "", equity: bal }];
  for (const t of closed) {
    bal += t.pnl ?? 0;
    pts.push({ label: dayKey(t.openedAt, tz), date: t.openedAt.toISOString(), equity: bal });
  }
  return pts;
}

export function summarize(trades: AnalyticsTrade[], startingBalance: number): Summary {
  const closed = sorted(trades);
  const pnls = closed.map((t) => t.pnl as number);
  const wins = closed.filter((t) => t.result === "WIN");
  const losses = closed.filter((t) => t.result === "LOSS");
  const be = closed.filter((t) => t.result === "BREAKEVEN");

  let maxW = 0, maxL = 0, w = 0, l = 0;
  for (const t of closed) {
    if (t.result === "WIN") { w++; l = 0; } else if (t.result === "LOSS") { l++; w = 0; } else { w = 0; l = 0; }
    maxW = Math.max(maxW, w);
    maxL = Math.max(maxL, l);
  }
  const current = w > 0 ? { type: "WIN" as const, length: w } : l > 0 ? { type: "LOSS" as const, length: l } : { type: "NONE" as const, length: 0 };

  const rs = closed.map((t) => t.rMultiple).filter((r): r is number => r !== null);
  const dd = calculateDrawdown(equityPoints(closed, startingBalance).map((p) => p.equity));
  const n = closed.length;

  return {
    trades: n,
    wins: wins.length,
    losses: losses.length,
    breakeven: be.length,
    winRate: n ? (wins.length / n) * 100 : 0,
    lossRate: n ? (losses.length / n) * 100 : 0,
    totalPnl: pnls.reduce((a, b) => a + b, 0),
    avgWin: mean(wins.map((t) => t.pnl as number)) ?? 0,
    avgLoss: mean(losses.map((t) => t.pnl as number)) ?? 0,
    profitFactor: calculateProfitFactor(pnls),
    avgR: mean(rs),
    expectancyR: calculateExpectancy(rs),
    avgRisk: mean(closed.map((t) => t.riskPercent)),
    avgRiskWins: mean(wins.map((t) => t.riskPercent)),
    avgRiskLosses: mean(losses.map((t) => t.riskPercent)),
    best: n ? Math.max(...pnls) : null,
    worst: n ? Math.min(...pnls) : null,
    maxWinStreak: maxW,
    maxLossStreak: maxL,
    currentStreak: current,
    maxDrawdownPercent: dd.maxDrawdownPercent,
    maxDrawdownAmount: dd.maxDrawdownAmount,
  };
}

export interface GroupRow {
  key: string;
  trades: number;
  winRate: number;
  pnl: number;
  avgR: number | null;
  avgRisk: number | null;
}

export function groupBy(trades: AnalyticsTrade[], keyFn: (t: AnalyticsTrade) => string | null | undefined, order?: string[]): GroupRow[] {
  const map = new Map<string, AnalyticsTrade[]>();
  for (const t of sorted(trades)) {
    const k = keyFn(t);
    if (!k) continue;
    (map.get(k) ?? map.set(k, []).get(k)!).push(t);
  }
  const rows: GroupRow[] = [...map.entries()].map(([key, ts]) => ({
    key,
    trades: ts.length,
    winRate: (ts.filter((t) => t.result === "WIN").length / ts.length) * 100,
    pnl: ts.reduce((a, t) => a + (t.pnl ?? 0), 0),
    avgR: mean(ts.map((t) => t.rMultiple).filter((r): r is number => r !== null)),
    avgRisk: mean(ts.map((t) => t.riskPercent)),
  }));
  if (order) rows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  else rows.sort((a, b) => b.trades - a.trades);
  return rows;
}

export function riskBucket(pct: number): string {
  if (pct <= 0.5) return "≤0.5%";
  if (pct <= 1) return "0.5–1%";
  if (pct <= 2) return "1–2%";
  if (pct <= 5) return "2–5%";
  return ">5%";
}
export const RISK_BUCKETS = ["≤0.5%", "0.5–1%", "1–2%", "2–5%", ">5%"];

export interface Breakdowns {
  instrument: GroupRow[];
  setup: GroupRow[];
  session: GroupRow[];
  direction: GroupRow[];
  weekday: GroupRow[];
  risk: GroupRow[];
  month: GroupRow[];
}

export function breakdowns(trades: AnalyticsTrade[], tz = DEFAULT_TZ): Breakdowns {
  return {
    instrument: groupBy(trades, (t) => t.instrument),
    setup: groupBy(trades, (t) => t.setup),
    session: groupBy(trades, (t) => t.session),
    direction: groupBy(trades, (t) => (t.direction === "LONG" ? "Long" : "Short")),
    weekday: groupBy(trades, (t) => weekdayName(t.openedAt, tz), WEEKDAYS),
    risk: groupBy(trades, (t) => riskBucket(t.riskPercent), RISK_BUCKETS),
    month: groupBy(trades, (t) => monthKey(t.openedAt, tz)).sort((a, b) => a.key.localeCompare(b.key)),
  };
}

export function pnlByDay(trades: AnalyticsTrade[], tz = DEFAULT_TZ) {
  const m = new Map<string, number>();
  for (const t of sorted(trades)) m.set(dayKey(t.openedAt, tz), (m.get(dayKey(t.openedAt, tz)) ?? 0) + (t.pnl ?? 0));
  return [...m.entries()].map(([day, pnl]) => ({ day, pnl })).sort((a, b) => a.day.localeCompare(b.day));
}

export function rDistribution(trades: AnalyticsTrade[]) {
  const edges = [-Infinity, -2, -1, 0, 1, 2, 3, Infinity];
  const labels = ["< −2R", "−2 to −1R", "−1 to 0R", "0 to 1R", "1 to 2R", "2 to 3R", "> 3R"];
  const counts = labels.map(() => 0);
  for (const t of sorted(trades)) {
    if (t.rMultiple === null) continue;
    for (let i = 0; i < labels.length; i++) {
      if (t.rMultiple >= edges[i] && t.rMultiple < edges[i + 1]) { counts[i]++; break; }
    }
  }
  return labels.map((label, i) => ({ label, count: counts[i], negative: i < 3 }));
}

export interface Insight {
  text: string;
  tone: "neutral" | "warn" | "good";
}

const fmtR = (r: number) => `${r >= 0 ? "+" : ""}${r.toFixed(2)}R`;

/**
 * Plain-language observations about the user's PAST behaviour.
 * Descriptive only — never a recommendation to buy or sell.
 */
export function generateInsights(trades: AnalyticsTrade[], startingBalance: number, now = new Date(), tz = DEFAULT_TZ): Insight[] {
  const out: Insight[] = [];
  const closed = sorted(trades);
  if (closed.length < 5) return [{ text: "Record at least 5 closed trades to unlock behaviour insights.", tone: "neutral" }];
  const s = summarize(closed, startingBalance);

  if (s.avgRiskLosses !== null && s.avgRiskWins !== null) {
    const worse = s.avgRiskLosses > s.avgRiskWins * 1.15;
    out.push({
      text: `Your average risk on losing trades is ${s.avgRiskLosses.toFixed(1)}%, compared with ${s.avgRiskWins.toFixed(1)}% on winning trades.`,
      tone: worse ? "warn" : "neutral",
    });
  }

  const thisMonth = monthKey(now, tz);
  const byInstr = new Map<string, AnalyticsTrade[]>();
  for (const t of closed.filter((t) => monthKey(t.openedAt, tz) === thisMonth)) {
    (byInstr.get(t.instrument) ?? byInstr.set(t.instrument, []).get(t.instrument)!).push(t);
  }
  const top = [...byInstr.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  if (top) {
    const rs = top[1].map((t) => t.rMultiple).filter((r): r is number => r !== null);
    const avg = mean(rs);
    out.push({
      text: `You took ${top[1].length} trade${top[1].length === 1 ? "" : "s"} on ${top[0]} this month${avg !== null ? `. Your average result was ${fmtR(avg)}` : ""}.`,
      tone: avg !== null && avg < 0 ? "warn" : "neutral",
    });
  }

  // Trades taken right after a loss, sized larger than the loser before.
  let escalations = 0, afterLoss = 0;
  for (let i = 1; i < closed.length; i++) {
    if (closed[i - 1].result === "LOSS" && dayKey(closed[i - 1].openedAt, tz) === dayKey(closed[i].openedAt, tz)) {
      afterLoss++;
      if (closed[i].riskPercent > closed[i - 1].riskPercent * 1.2) escalations++;
    }
  }
  if (afterLoss >= 3 && escalations > 0) {
    out.push({
      text: `On ${escalations} of ${afterLoss} same-day trades that followed a loss, you increased your risk by more than 20%.`,
      tone: "warn",
    });
  }

  const b = breakdowns(closed, tz);
  const sessionRows = b.session.filter((r) => r.trades >= 3 && r.avgR !== null);
  if (sessionRows.length >= 2) {
    const best = [...sessionRows].sort((x, y) => (y.avgR as number) - (x.avgR as number))[0];
    const worst = [...sessionRows].sort((x, y) => (x.avgR as number) - (y.avgR as number))[0];
    if (best.key !== worst.key) {
      out.push({ text: `By session, your history shows ${best.key} at ${fmtR(best.avgR as number)} per trade and ${worst.key} at ${fmtR(worst.avgR as number)} (${best.trades} and ${worst.trades} trades).`, tone: "neutral" });
    }
  }

  const days = new Map<string, number>();
  for (const t of closed) days.set(dayKey(t.openedAt, tz), (days.get(dayKey(t.openedAt, tz)) ?? 0) + 1);
  const busy = [...days.values()].filter((c) => c >= 6).length;
  if (busy > 0) out.push({ text: `You took 6 or more trades on ${busy} day${busy === 1 ? "" : "s"}.`, tone: "warn" });

  const scored = closed.filter((t) => t.checklistScore !== null && t.checklistScore !== undefined);
  if (scored.length >= 5) {
    const hi = scored.filter((t) => (t.checklistScore as number) >= 80);
    const lo = scored.filter((t) => (t.checklistScore as number) < 80);
    const rHi = mean(hi.map((t) => t.rMultiple).filter((r): r is number => r !== null));
    const rLo = mean(lo.map((t) => t.rMultiple).filter((r): r is number => r !== null));
    if (rHi !== null && rLo !== null) {
      out.push({ text: `Trades with a pre-trade discipline score of 80%+ averaged ${fmtR(rHi)}; the rest averaged ${fmtR(rLo)}.`, tone: "neutral" });
    }
  }

  if (s.maxLossStreak >= 4) out.push({ text: `Your longest losing streak is ${s.maxLossStreak} trades.`, tone: "neutral" });
  return out;
}
