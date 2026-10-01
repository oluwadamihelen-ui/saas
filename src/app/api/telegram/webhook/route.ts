import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HELP_TEXT, LINKED_TEXT, NOT_LINKED_TEXT, statusText } from "@/lib/notifications/messages";
import { parseCommand, secretMatches, sendTelegram, type TelegramUpdate } from "@/lib/notifications/telegram";
import { computeGuardrail, loadTrades } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * Telegram bot webhook. Register it with:
 *   setWebhook?url=<APP_URL>/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
 * Telegram echoes the secret in `X-Telegram-Bot-Api-Secret-Token`; anything else is rejected.
 */
export async function POST(req: Request) {
  if (!secretMatches(req.headers.get("x-telegram-bot-api-secret-token"), process.env.TELEGRAM_WEBHOOK_SECRET)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const update = (await req.json().catch(() => null)) as TelegramUpdate | null;
  const msg = update?.message;
  if (!msg || msg.chat.type !== "private") return NextResponse.json({ ok: true }); // ignore groups/channels
  const chatId = String(msg.chat.id);
  const cmd = parseCommand(msg.text);
  if (!cmd) return NextResponse.json({ ok: true });

  if (cmd.cmd === "start" || cmd.cmd === "code") {
    const user = await prisma.user.findFirst({ where: { telegramLinkCode: cmd.arg, telegramLinkExpires: { gt: new Date() } } });
    if (!user) {
      await sendTelegram(chatId, "That code is invalid or has expired. Generate a new one in RiskPilot → Settings.");
      return NextResponse.json({ ok: true });
    }
    // One chat ↔ one user: release the chat if it was linked to someone else.
    await prisma.user.updateMany({ where: { telegramChatId: chatId, id: { not: user.id } }, data: { telegramChatId: null } });
    await prisma.user.update({ where: { id: user.id }, data: { telegramChatId: chatId, telegramLinkCode: null, telegramLinkExpires: null } });
    await sendTelegram(chatId, LINKED_TEXT);
    return NextResponse.json({ ok: true });
  }

  const user = await prisma.user.findUnique({ where: { telegramChatId: chatId } });
  if (!user) {
    await sendTelegram(chatId, NOT_LINKED_TEXT);
    return NextResponse.json({ ok: true });
  }
  if (cmd.cmd === "stop") {
    await prisma.user.update({ where: { id: user.id }, data: { telegramChatId: null } });
    await sendTelegram(chatId, "Unlinked. You won't receive RiskPilot messages here any more.");
  } else if (cmd.cmd === "status") {
    const account = user.activeAccountId ? await prisma.account.findFirst({ where: { id: user.activeAccountId, userId: user.id }, include: { riskSettings: true } }) : null;
    if (!account?.riskSettings) await sendTelegram(chatId, "No active account yet.");
    else {
      const trades = await loadTrades(user.id, account.id);
      const { status, todays } = computeGuardrail({ timezone: user.timezone, startingBalance: account.startingBalance, riskSettings: account.riskSettings }, trades);
      await sendTelegram(chatId, statusText(account.name, account.currency, status, todays.length, account.riskSettings.maxTradesPerDay));
    }
  } else await sendTelegram(chatId, HELP_TEXT);
  return NextResponse.json({ ok: true });
}
