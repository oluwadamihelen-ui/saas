import "server-only";
import { prisma } from "@/lib/db";
import type { AnalyticsTrade } from "@/lib/engine/analytics";
import { evaluateGuardrail } from "@/lib/engine/guardrail";
import { evaluateChallenge, peakBalance, type DrawdownType } from "@/lib/engine/challenge";
import { dayKey, weekStartKey } from "@/lib/engine/time";
import type { AppContext } from "@/lib/session";

export type TradeRow = Awaited<ReturnType<typeof loadTrades>>[number];

/** All trades for ONE account that belongs to the user (userId is part of every query). */
export function loadTrades(userId: string, accountId: string) {
  return prisma.trade.findMany({
    where: { userId, accountId },
    include: { tags: true, _count: { select: { screenshots: true } } },
    orderBy: { openedAt: "desc" },
  });
}

export function toAnalytics(t: TradeRow): AnalyticsTrade {
  return {
    id: t.id,
    openedAt: t.openedAt,
    instrument: t.instrument,
    direction: t.direction,
    result: t.result,
    pnl: t.pnl,
    rMultiple: t.rMultiple,
    riskPercent: t.riskPercent,
    riskAmount: t.riskAmount,
    setup: t.setup,
    session: t.session,
    checklistScore: t.checklistScore,
    emotionBefore: t.emotionBefore,
  };
}

export function currentBalance(startingBalance: number, trades: { pnl: number | null }[]) {
  return startingBalance + trades.reduce((a, t) => a + (t.pnl ?? 0), 0);
}

export interface GuardrailArgs {
  timezone: string;
  startingBalance: number;
  riskSettings: {
    maxDailyLossPercent: number;
    maxWeeklyLossPercent: number;
    maxTradesPerDay: number;
    maxTotalDrawdownPercent?: number | null;
    drawdownType?: string;
    profitTargetPercent?: number | null;
  };
}

export function computeGuardrail(a: GuardrailArgs, trades: TradeRow[], now = new Date()) {
  const tz = a.timezone;
  const today = dayKey(now, tz);
  const week = weekStartKey(now, tz);
  const todays = trades.filter((t) => dayKey(t.openedAt, tz) === today);
  const weeks = trades.filter((t) => weekStartKey(t.openedAt, tz) === week);
  const rs = a.riskSettings;
  const balance = currentBalance(a.startingBalance, trades);
  const closed = trades.filter((t) => t.pnl !== null).sort((x, y) => x.openedAt.getTime() - y.openedAt.getTime());
  const challenge = evaluateChallenge({
    startingBalance: a.startingBalance,
    balance,
    peakBalance: peakBalance(a.startingBalance, closed.map((t) => t.pnl as number)),
    maxTotalDrawdownPercent: rs.maxTotalDrawdownPercent ?? null,
    drawdownType: (rs.drawdownType as DrawdownType) ?? "STATIC",
    profitTargetPercent: rs.profitTargetPercent ?? null,
  });
  const status = evaluateGuardrail({
    balance,
    pnlToday: todays.reduce((x, t) => x + (t.pnl ?? 0), 0),
    pnlWeek: weeks.reduce((x, t) => x + (t.pnl ?? 0), 0),
    tradesToday: todays.length,
    openRisk: trades.filter((t) => t.result === "OPEN").reduce((x, t) => x + t.riskAmount, 0),
    riskCommittedToday: todays.reduce((x, t) => x + t.riskAmount, 0),
    maxDailyLossPercent: rs.maxDailyLossPercent,
    maxWeeklyLossPercent: rs.maxWeeklyLossPercent,
    maxTradesPerDay: rs.maxTradesPerDay,
  });
  if (challenge.enabled) {
    // The total-drawdown rule overrides the day: you can't risk past the floor even if today's limit has room.
    if (challenge.breached) { status.state = "STOP"; status.messages = [...status.messages, ...challenge.messages]; }
    else if (challenge.state === "DANGER" && status.state === "OK") { status.state = "CAUTION"; status.messages = [...status.messages, ...challenge.messages]; }
    if (challenge.room !== null) status.dailyRemaining = Math.min(status.dailyRemaining, challenge.room);
    status.challenge = challenge;
  }
  return { todays, status };
}

export function guardrailFor(ctx: AppContext, trades: TradeRow[], now = new Date()) {
  return computeGuardrail({ timezone: ctx.user.timezone, startingBalance: ctx.account.startingBalance, riskSettings: ctx.account.riskSettings }, trades, now);
}

/** Re-computes the DailyRisk roll-up rows for the given days. */
export async function refreshDailyRisk(userId: string, accountId: string, dates: Date[], tz: string, maxDailyLossPercent: number, startingBalance: number) {
  const keys = [...new Set(dates.map((d) => dayKey(d, tz)))];
  if (!keys.length) return;
  const all = await prisma.trade.findMany({ where: { userId, accountId }, select: { openedAt: true, pnl: true, riskAmount: true } });
  for (const day of keys) {
    const ts = all.filter((t) => dayKey(t.openedAt, tz) === day);
    const pnl = ts.reduce((a, t) => a + (t.pnl ?? 0), 0);
    const riskUsed = ts.reduce((a, t) => a + t.riskAmount, 0);
    const before = all.filter((t) => dayKey(t.openedAt, tz) < day).reduce((a, t) => a + (t.pnl ?? 0), 0);
    const limit = ((startingBalance + before) * maxDailyLossPercent) / 100;
    if (!ts.length) {
      await prisma.dailyRisk.deleteMany({ where: { userId, accountId, day } });
      continue;
    }
    const data = { userId, tradeCount: ts.length, riskUsed, pnl, limitHit: -pnl >= limit - 1e-9 };
    await prisma.dailyRisk.upsert({ where: { accountId_day: { accountId, day } }, create: { accountId, day, ...data }, update: data });
  }
}
