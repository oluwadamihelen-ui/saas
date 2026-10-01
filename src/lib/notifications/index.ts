import "server-only";
import { prisma } from "@/lib/db";
import { sendTelegram } from "./telegram";

export type NotifyKind = "limit" | "reminder" | "billing";
export type NotifyResult = "sent" | "duplicate" | "unlinked" | "muted" | "failed";

/**
 * Sends a Telegram message at most once per (user, kind, key).
 * Respects the user's preferences; billing messages are always allowed once linked.
 * The log row is claimed BEFORE sending (so concurrent runs can't double-send) and
 * released if the send fails, so a later run can retry.
 */
export async function notifyUser(userId: string, kind: NotifyKind, key: string, text: string): Promise<NotifyResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { telegramChatId: true, notifyLimits: true, notifyReminders: true } });
  if (!user?.telegramChatId) return "unlinked";
  if (kind === "limit" && !user.notifyLimits) return "muted";
  if (kind === "reminder" && !user.notifyReminders) return "muted";

  try {
    await prisma.notificationLog.create({ data: { userId, kind, key } });
  } catch {
    return "duplicate";
  }
  const ok = await sendTelegram(user.telegramChatId, text);
  if (!ok) {
    await prisma.notificationLog.deleteMany({ where: { userId, kind, key } });
    return "failed";
  }
  return "sent";
}
