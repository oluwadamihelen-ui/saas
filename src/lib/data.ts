import "server-only";
import { prisma } from "@/lib/db";
import type { AnalyticsTrade } from "@/lib/engine/analytics";
import { evaluateGuardrail } from "@/lib/engine/guardrail";
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

export function guardrailFor(ctx: AppContext, trades: TradeRow[], now = new Date()) {
  const tz = ctx.user.timezone;
  const today = dayKey(now, tz);
  const week = weekStartKey(now, tz);
  const todays = trades.filter((t) => dayKey(t.openedAt, tz) === today);
  const weeks = trades.filter((t) => weekStartKey(t.openedAt, tz) === week);
  const rs = ctx.account.riskSettings;
  return {
    todays,
    status: evaluateGuardrail({
      balance: currentBalance(ctx.account.startingBalance, trades),
      pnlToday: todays.reduce((a, t) => a + (t.pnl ?? 0), 0),
      pnlWeek: weeks.reduce((a, t) => a + (t.pnl ?? 0), 0),
      tradesToday: todays.length,
      openRisk: trades.filter((t) => t.result === "OPEN").reduce((a, t) => a + t.riskAmount, 0),
      riskCommittedToday: todays.reduce((a, t) => a + t.riskAmount, 0),
      maxDailyLossPercent: rs.maxDailyLossPercent,
      maxWeeklyLossPercent: rs.maxWeeklyLossPercent,
      maxTradesPerDay: rs.maxTradesPerDay,
    }),
  };
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
