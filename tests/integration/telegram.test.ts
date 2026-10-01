import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { notifyUser } from "@/lib/notifications";
import { checkLimitAlerts } from "@/lib/notifications/alerts";
import { POST as telegramWebhook } from "@/app/api/telegram/webhook/route";
import { cleanup, hasDb, makeAccount, makeUser } from "./helpers";

const users: string[] = [];
const sent: { chat_id: string; text: string }[] = [];
let sendOk = true;

beforeEach(() => {
  sent.length = 0;
  sendOk = true;
  process.env.TELEGRAM_BOT_TOKEN = "123:TEST";
  process.env.TELEGRAM_WEBHOOK_SECRET = "hook-secret";
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: { body?: string }) => {
    if (sendOk) sent.push(JSON.parse(init?.body ?? "{}"));
    return new Response("{}", { status: sendOk ? 200 : 500 });
  }));
});
afterEach(() => vi.unstubAllGlobals());
afterAll(() => cleanup(users));

const update = (text: string, chat = 4242, type = "private") =>
  new Request("http://x/api/telegram/webhook", {
    method: "POST",
    headers: { "x-telegram-bot-api-secret-token": "hook-secret", "content-type": "application/json" },
    body: JSON.stringify({ message: { text, chat: { id: chat, type } } }),
  });

describe.skipIf(!hasDb)("notifyUser", () => {
  it("sends once per (kind,key) and dedupes repeats", async () => {
    const u = await makeUser({ telegramChatId: `c-${Math.random()}` }); users.push(u.id);
    expect(await notifyUser(u.id, "limit", "k1", "hello")).toBe("sent");
    expect(await notifyUser(u.id, "limit", "k1", "hello")).toBe("duplicate");
    expect(await notifyUser(u.id, "limit", "k2", "again")).toBe("sent");
    expect(sent).toHaveLength(2);
  });
  it("does nothing for unlinked users and respects mute preferences (billing is never muted)", async () => {
    const un = await makeUser(); users.push(un.id);
    expect(await notifyUser(un.id, "limit", "k", "x")).toBe("unlinked");
    const m = await makeUser({ telegramChatId: `c-${Math.random()}`, notifyLimits: false, notifyReminders: false }); users.push(m.id);
    expect(await notifyUser(m.id, "limit", "k", "x")).toBe("muted");
    expect(await notifyUser(m.id, "reminder", "k", "x")).toBe("muted");
    expect(await notifyUser(m.id, "billing", "k", "x")).toBe("sent");
  });
  it("releases the claim when sending fails so it can be retried", async () => {
    const u = await makeUser({ telegramChatId: `c-${Math.random()}` }); users.push(u.id);
    sendOk = false;
    expect(await notifyUser(u.id, "limit", "retry", "x")).toBe("failed");
    sendOk = true;
    expect(await notifyUser(u.id, "limit", "retry", "x")).toBe("sent");
  });
});

describe.skipIf(!hasDb)("limit alerts", () => {
  it("alerts once when the daily limit is hit and never tells the user to trade", async () => {
    const u = await makeUser({ telegramChatId: `c-${Math.random()}` }); users.push(u.id);
    const a = await makeAccount(u.id);
    await prisma.trade.create({ data: { userId: u.id, accountId: a.id, openedAt: new Date(), instrument: "XAUUSD", direction: "LONG", entryPrice: 2650, stopLoss: 2640, lots: 0.03, riskPercent: 3, riskAmount: 30, result: "LOSS", pnl: -31, rMultiple: -1 } });
    await checkLimitAlerts(u.id, a.id);
    await checkLimitAlerts(u.id, a.id);
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain("Daily risk limit reached.");
    expect(sent[0].text).toContain("Your rule says to stop trading for today.");
  });
  it("stays quiet when well inside limits and for unlinked users", async () => {
    const u = await makeUser({ telegramChatId: `c-${Math.random()}` }); users.push(u.id);
    const a = await makeAccount(u.id);
    await prisma.trade.create({ data: { userId: u.id, accountId: a.id, openedAt: new Date(), instrument: "XAUUSD", direction: "LONG", entryPrice: 2650, stopLoss: 2640, lots: 0.01, riskPercent: 1, riskAmount: 10, result: "WIN", pnl: 20, rMultiple: 2 } });
    await checkLimitAlerts(u.id, a.id);
    const n = await makeUser(); users.push(n.id);
    const na = await makeAccount(n.id);
    await checkLimitAlerts(n.id, na.id);
    expect(sent).toHaveLength(0);
  });
});

describe.skipIf(!hasDb)("telegram bot webhook", () => {
  it("rejects requests without the secret header", async () => {
    const res = await telegramWebhook(new Request("http://x", { method: "POST", headers: { "x-telegram-bot-api-secret-token": "wrong" }, body: "{}" }));
    expect(res.status).toBe(401);
    expect((await telegramWebhook(new Request("http://x", { method: "POST", body: "{}" }))).status).toBe(401);
  });

  it("links a chat with a valid, unexpired code (once) and /stop unlinks", async () => {
    const chat = 880000 + Math.floor(Math.random() * 1000);
    const u = await makeUser({ telegramLinkCode: "LINK2345", telegramLinkExpires: new Date(Date.now() + 60_000) }); users.push(u.id);
    await telegramWebhook(update("/start LINK2345", chat));
    const linked = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(linked.telegramChatId).toBe(String(chat));
    expect(linked.telegramLinkCode).toBeNull();
    expect(sent.at(-1)?.text).toContain("linked");
    await telegramWebhook(update("/start LINK2345", chat + 1)); // code is single-use
    expect(sent.at(-1)?.text).toContain("invalid or has expired");
    await telegramWebhook(update("/stop", chat));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).telegramChatId).toBeNull();
  });

  it("rejects expired codes and ignores group chats", async () => {
    const u = await makeUser({ telegramLinkCode: "OLDC2345", telegramLinkExpires: new Date(Date.now() - 1000) }); users.push(u.id);
    await telegramWebhook(update("/start OLDC2345", 991001));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).telegramChatId).toBeNull();
    sent.length = 0;
    await telegramWebhook(update("/start OLDC2345", -100123, "supergroup"));
    expect(sent).toHaveLength(0);
  });

  it("moves a chat to a new user rather than breaking the unique link", async () => {
    const chat = 770000 + Math.floor(Math.random() * 1000);
    const a = await makeUser({ telegramChatId: String(chat) }); users.push(a.id);
    const b = await makeUser({ telegramLinkCode: "MOVE2345", telegramLinkExpires: new Date(Date.now() + 60_000) }); users.push(b.id);
    await telegramWebhook(update("/start MOVE2345", chat));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: a.id } })).telegramChatId).toBeNull();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: b.id } })).telegramChatId).toBe(String(chat));
  });

  it("/status reports the linked user's own numbers; unlinked chats are told how to link", async () => {
    const chat = 660000 + Math.floor(Math.random() * 1000);
    const u = await makeUser({ telegramChatId: String(chat) }); users.push(u.id);
    const a = await makeAccount(u.id, { name: "Status Acct" });
    await prisma.user.update({ where: { id: u.id }, data: { activeAccountId: a.id } });
    await telegramWebhook(update("/status", chat));
    expect(sent.at(-1)?.text).toContain("Status Acct");
    expect(sent.at(-1)?.text).toContain("Trades: 0 / 5");
    await telegramWebhook(update("/status", 555999));
    expect(sent.at(-1)?.text).toContain("isn't linked");
  });
});
