/**
 * Message text only (pure). Messages describe the user's OWN rules and records —
 * they never mention what to buy or sell, and never promise outcomes.
 */
import type { GuardrailStatus } from "@/lib/engine/guardrail";

export const money = (v: number, currency: string) => {
  const sym: Record<string, string> = { USD: "$", NGN: "₦", EUR: "€", GBP: "£" };
  return `${v < 0 ? "-" : ""}${sym[currency] ?? currency + " "}${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: Math.abs(v) >= 1000 ? 0 : 2 })}`;
};

export function limitAlert(g: GuardrailStatus, account: string, currency: string): { kind: "stop" | "caution"; text: string } | null {
  if (g.state === "STOP") {
    const lines = [`🛑 ${account}`, ...g.messages];
    if (g.dailyLimitReached) lines.push(`Loss today: ${money(-g.dailyLossUsed, currency)} of your ${money(-g.dailyLimitAmount, currency)} limit.`);
    return { kind: "stop", text: lines.join("\n") };
  }
  if (g.state === "CAUTION") {
    return { kind: "caution", text: `⚠️ ${account}\nYou are close to one of your own limits.\nDaily loss used: ${Math.round(g.dailyUsedPercent)}% · Trades left today: ${g.tradesRemaining}` };
  }
  return null;
}

export function openTradesReminder(count: number): string {
  return `📓 You have ${count} open trade${count === 1 ? "" : "s"} in your journal. When a trade is closed, add its result so your analytics stay accurate.`;
}

export function proExpiryReminder(daysLeft: number): string {
  return `Your RiskPilot Pro access ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Open Plan & billing to extend it or turn on auto-renew.`;
}

export function weeklyRecap(p: { account: string; currency: string; trades: number; pnl: number; avgRiskPercent: number | null; wins: number }): string {
  return [
    `📊 Last week · ${p.account}`,
    `Trades: ${p.trades} (${p.wins} winners)`,
    `P&L: ${money(p.pnl, p.currency)}`,
    p.avgRiskPercent !== null ? `Average risk per trade: ${p.avgRiskPercent.toFixed(2)}%` : "",
    "This is a record of what happened, not a prediction.",
  ].filter(Boolean).join("\n");
}

export const LINKED_TEXT = "✅ Telegram is linked to RiskPilot. You'll get alerts when you get close to your own risk limits. Send /status for today's numbers or /stop to unlink.";
export const HELP_TEXT = "RiskPilot bot\n/status – today's risk and trade count\n/stop – unlink this chat\nTo link, open RiskPilot → Settings → Connect Telegram.";
export const NOT_LINKED_TEXT = "This chat isn't linked yet. Open RiskPilot → Settings → Connect Telegram and send the code you see there.";

export function statusText(account: string, currency: string, g: GuardrailStatus, tradesToday: number, maxTrades: number): string {
  return [
    `${account}`,
    `Daily loss: ${money(-g.dailyLossUsed, currency)} / ${money(-g.dailyLimitAmount, currency)} (${Math.round(g.dailyUsedPercent)}% used)`,
    `Remaining risk today: ${money(g.dailyRemaining, currency)}`,
    `Trades: ${tradesToday} / ${maxTrades}`,
    ...g.messages,
  ].join("\n");
}
