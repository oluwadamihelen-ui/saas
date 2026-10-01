import { randomInt, timingSafeEqual } from "crypto";

const API = "https://api.telegram.org";

export function telegramConfigured() {
  return !!process.env.TELEGRAM_BOT_TOKEN;
}

/** Sends a plain-text message. Returns false (never throws) so notification failures can't break trades or billing. */
export async function sendTelegram(chatId: string, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  try {
    const res = await fetch(`${API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Unambiguous alphabet (no 0/O/1/I) so codes are easy to read and type. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateLinkCode(len = 8): string {
  return Array.from({ length: len }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}
export const LINK_CODE_TTL_MS = 15 * 60_000;

export function secretMatches(given: string | null, expected: string | undefined): boolean {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface TelegramUpdate {
  message?: { text?: string; chat: { id: number | string; type: string } };
}

/** Parses "/start CODE" (deep link), "/status", "/stop", "/help", or a bare link code. */
export function parseCommand(text: string | undefined): { cmd: "start" | "status" | "stop" | "help" | "code"; arg?: string } | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  const m = t.match(/^\/(\w+)(?:@\w+)?(?:\s+(\S+))?/);
  if (m) {
    const c = m[1].toLowerCase();
    if (c === "start") return m[2] ? { cmd: "start", arg: m[2].toUpperCase() } : { cmd: "help" };
    if (c === "status" || c === "stop" || c === "help") return { cmd: c };
    return { cmd: "help" };
  }
  if (/^[A-Za-z0-9]{8}$/.test(t)) return { cmd: "code", arg: t.toUpperCase() };
  return null;
}
