import { describe, expect, it } from "vitest";
import { evaluateGuardrail } from "@/lib/engine/guardrail";
import { HELP_TEXT, LINKED_TEXT, limitAlert, openTradesReminder, proExpiryReminder, statusText, weeklyRecap } from "@/lib/notifications/messages";
import { generateLinkCode, parseCommand, secretMatches } from "@/lib/notifications/telegram";

const base = { balance: 970, pnlToday: -30, pnlWeek: -30, tradesToday: 3, openRisk: 0, riskCommittedToday: 30, maxDailyLossPercent: 3, maxWeeklyLossPercent: 6, maxTradesPerDay: 5 };

describe("limit alerts", () => {
  it("STOP uses the user's own-rule wording", () => {
    const a = limitAlert(evaluateGuardrail(base), "Exness", "USD")!;
    expect(a.kind).toBe("stop");
    expect(a.text).toContain("Daily risk limit reached.");
    expect(a.text).toContain("Your rule says to stop trading for today.");
  });
  it("CAUTION near limits, nothing when fine", () => {
    expect(limitAlert(evaluateGuardrail({ ...base, balance: 982, pnlToday: -22, pnlWeek: -22 }), "A", "USD")?.kind).toBe("caution");
    expect(limitAlert(evaluateGuardrail({ ...base, balance: 1000, pnlToday: 0, pnlWeek: 0, tradesToday: 1 }), "A", "USD")).toBeNull();
  });
  it("no message ever tells the user to buy or sell or promises outcomes", () => {
    const all = [limitAlert(evaluateGuardrail(base), "A", "USD")!.text, openTradesReminder(2), proExpiryReminder(2), LINKED_TEXT, HELP_TEXT,
      weeklyRecap({ account: "A", currency: "USD", trades: 5, pnl: 12, avgRiskPercent: 1, wins: 3 }), statusText("A", "USD", evaluateGuardrail(base), 3, 5)].join(" ").toLowerCase();
    expect(all).not.toMatch(/\b(buy|sell|guarantee|profit(s)? (is|are) )/);
  });
  it("pluralises reminders", () => {
    expect(openTradesReminder(1)).toContain("1 open trade ");
    expect(openTradesReminder(3)).toContain("3 open trades");
    expect(proExpiryReminder(1)).toContain("1 day.");
  });
});

describe("telegram helpers", () => {
  it("parses commands and bare codes", () => {
    expect(parseCommand("/start ABCD2345")).toEqual({ cmd: "start", arg: "ABCD2345" });
    expect(parseCommand("/start abcd2345")).toEqual({ cmd: "start", arg: "ABCD2345" });
    expect(parseCommand("/start")).toEqual({ cmd: "help" });
    expect(parseCommand("/status@RiskPilotBot")).toEqual({ cmd: "status" });
    expect(parseCommand("/stop")).toEqual({ cmd: "stop" });
    expect(parseCommand("/whatever")).toEqual({ cmd: "help" });
    expect(parseCommand("ab12cd34")).toEqual({ cmd: "code", arg: "AB12CD34" });
    expect(parseCommand("hello there")).toBeNull();
    expect(parseCommand(undefined)).toBeNull();
  });
  it("link codes are 8 unambiguous characters", () => {
    for (let i = 0; i < 50; i++) expect(generateLinkCode()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });
  it("secret comparison", () => {
    expect(secretMatches("abc", "abc")).toBe(true);
    expect(secretMatches("abd", "abc")).toBe(false);
    expect(secretMatches(null, "abc")).toBe(false);
    expect(secretMatches("abc", undefined)).toBe(false);
  });
});
