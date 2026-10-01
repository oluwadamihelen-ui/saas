import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cronAuthorized } from "@/lib/cron-auth";
import { notifyUser } from "@/lib/notifications";
import { openTradesReminder, proExpiryReminder, weeklyRecap } from "@/lib/notifications/messages";
import { dayKey, hourIn, weekStartKey } from "@/lib/engine/time";

export const dynamic = "force-dynamic";

/** Daily cron: journal reminders, Pro-expiry nudges and a Monday recap — only to linked users, only in their waking hours. */
export async function GET(req: Request) {
  const auth = cronAuthorized(req);
  if (!auth.ok) return new NextResponse(auth.status === 503 ? "CRON_SECRET not configured" : "Unauthorized", { status: auth.status });
  const now = new Date();
  const users = await prisma.user.findMany({ where: { telegramChatId: { not: null } }, select: { id: true, timezone: true, notifyReminders: true, activeAccountId: true } });
  const out = { users: users.length, sent: 0 };

  for (const u of users) {
    const hour = hourIn(now, u.timezone);
    if (hour < 7 || hour > 21) continue;
    const today = dayKey(now, u.timezone);
    const bump = (r: string) => { if (r === "sent") out.sent++; };

    if (u.notifyReminders) {
      const stale = await prisma.trade.count({ where: { userId: u.id, result: "OPEN", openedAt: { lt: new Date(now.getTime() - 24 * 3_600_000) } } });
      if (stale > 0) bump(await notifyUser(u.id, "reminder", `open-trades:${today}`, openTradesReminder(stale)));

      // Monday recap of the previous week for the active account.
      const wk = weekStartKey(now, u.timezone);
      if (dayKey(now, u.timezone) === wk && u.activeAccountId) {
        const account = await prisma.account.findFirst({ where: { id: u.activeAccountId, userId: u.id } });
        if (account) {
          const since = new Date(now.getTime() - 8 * 86_400_000);
          const trades = (await prisma.trade.findMany({ where: { userId: u.id, accountId: account.id, openedAt: { gte: since }, pnl: { not: null } } })).filter((t) => weekStartKey(t.openedAt, u.timezone) < wk);
          if (trades.length) {
            bump(await notifyUser(u.id, "reminder", `recap:${wk}`, weeklyRecap({
              account: account.name, currency: account.currency, trades: trades.length, wins: trades.filter((t) => (t.pnl ?? 0) > 0).length,
              pnl: trades.reduce((a, t) => a + (t.pnl ?? 0), 0), avgRiskPercent: trades.reduce((a, t) => a + t.riskPercent, 0) / trades.length,
            })));
          }
        }
      }
    }

    // Pro expiring soon without auto-renew (billing messages are not muted by preferences).
    const sub = await prisma.subscription.findFirst({ where: { userId: u.id, status: "ACTIVE", autoRenew: false, currentPeriodEnd: { gt: now, lt: new Date(now.getTime() + 3 * 86_400_000) } } });
    if (sub) bump(await notifyUser(u.id, "billing", `expiry:${sub.id}:${sub.currentPeriodEnd.toISOString().slice(0, 10)}`, proExpiryReminder(Math.max(1, Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / 86_400_000)))));
  }
  return NextResponse.json(out);
}
