import "server-only";
import { prisma } from "@/lib/db";
import { computeGuardrail, loadTrades } from "@/lib/data";
import { dayKey } from "@/lib/engine/time";
import { limitAlert } from "./messages";
import { notifyUser } from "./index";

/**
 * Called after trades change. Sends a Telegram alert when the user reaches (or nears)
 * one of THEIR OWN limits — at most once per day per level. Never throws.
 */
export async function checkLimitAlerts(userId: string, accountId: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { telegramChatId: true, timezone: true } });
    if (!user?.telegramChatId) return;
    const account = await prisma.account.findFirst({ where: { id: accountId, userId }, include: { riskSettings: true } });
    if (!account?.riskSettings) return;
    const trades = await loadTrades(userId, accountId);
    const { status } = computeGuardrail({ timezone: user.timezone, startingBalance: account.startingBalance, riskSettings: account.riskSettings }, trades);
    const alert = limitAlert(status, account.name, account.currency);
    if (!alert) return;
    const day = dayKey(new Date(), user.timezone);
    // A STOP alert supersedes CAUTION for the day.
    if (alert.kind === "caution") {
      const stopSent = await prisma.notificationLog.findUnique({ where: { userId_kind_key: { userId, kind: "limit", key: `stop:${accountId}:${day}` } } });
      if (stopSent) return;
    }
    await notifyUser(userId, "limit", `${alert.kind}:${accountId}:${day}`, alert.text);
  } catch {
    // alerts must never break the trade flow
  }
}
