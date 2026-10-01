import { describe, expect, it } from "vitest";
import { breakdowns, generateInsights, summarize, type AnalyticsTrade } from "@/lib/engine/analytics";
import { disciplineScore, evaluateGuardrail } from "@/lib/engine/guardrail";
import { dayKey, weekStartKey, weekdayName } from "@/lib/engine/time";

let n = 0;
function t(day: string, pnl: number, risk = 10, over: Partial<AnalyticsTrade> = {}): AnalyticsTrade {
  return {
    id: String(++n),
    openedAt: new Date(`${day}T10:00:00Z`),
    instrument: "XAUUSD",
    direction: "LONG",
    result: pnl > 0 ? "WIN" : pnl < 0 ? "LOSS" : "BREAKEVEN",
    pnl,
    rMultiple: pnl / risk,
    riskPercent: 1,
    riskAmount: risk,
    ...over,
  };
}

describe("summarize", () => {
  const trades = [t("2026-09-01", 20), t("2026-09-02", -10), t("2026-09-03", 30), t("2026-09-04", -10), t("2026-09-05", -10)];
  const s = summarize(trades, 1000);
  it("core stats", () => {
    expect(s.trades).toBe(5);
    expect(s.winRate).toBe(40);
    expect(s.lossRate).toBe(60);
    expect(s.totalPnl).toBe(20);
    expect(s.avgWin).toBe(25);
    expect(s.avgLoss).toBe(-10);
    expect(s.profitFactor).toBeCloseTo(50 / 30);
    expect(s.best).toBe(30);
    expect(s.worst).toBe(-10);
    expect(s.maxLossStreak).toBe(2);
    expect(s.maxWinStreak).toBe(1);
    expect(s.currentStreak).toEqual({ type: "LOSS", length: 2 });
    expect(s.expectancyR).toBeCloseTo((2 - 1 + 3 - 1 - 1) / 5);
  });
  it("drawdown from equity", () => {
    // 1000,1020,1010,1040,1030,1020 → peak 1040, trough 1020
    expect(s.maxDrawdownAmount).toBeCloseTo(20);
  });
  it("ignores open trades and handles empty", () => {
    const open = { ...t("2026-09-06", 0), result: "OPEN" as const, pnl: null, rMultiple: null };
    expect(summarize([open], 1000).trades).toBe(0);
    expect(summarize([], 1000).winRate).toBe(0);
  });
});

describe("breakdowns", () => {
  it("groups by instrument, direction, weekday and month", () => {
    const b = breakdowns([
      t("2026-09-07", 10, 10, { instrument: "BTCUSD" }), // Monday
      t("2026-09-08", -10, 10, { direction: "SHORT" }),
      t("2026-10-01", 10),
    ]);
    expect(b.instrument.find((r) => r.key === "BTCUSD")?.trades).toBe(1);
    expect(b.direction.map((r) => r.key).sort()).toEqual(["Long", "Short"]);
    expect(b.weekday[0].key).toBe("Mon");
    expect(b.month.map((m) => m.key)).toEqual(["2026-09", "2026-10"]);
  });
});

describe("insights", () => {
  it("needs enough data", () => {
    expect(generateInsights([t("2026-09-01", 10)], 1000)[0].text).toMatch(/at least 5/);
  });
  it("describes risk on losers vs winners, never gives signals", () => {
    const trades = [
      t("2026-09-01", 10, 10, { riskPercent: 1 }),
      t("2026-09-02", 10, 10, { riskPercent: 1 }),
      t("2026-09-03", -30, 30, { riskPercent: 3 }),
      t("2026-09-04", -30, 30, { riskPercent: 3 }),
      t("2026-09-05", 10, 10, { riskPercent: 1 }),
    ];
    const text = generateInsights(trades, 1000, new Date("2026-09-10T00:00:00Z")).map((i) => i.text).join(" | ");
    expect(text).toMatch(/average risk on losing trades is 3\.0%, compared with 1\.0%/);
    expect(text).toMatch(/5 trades on XAUUSD this month/);
    expect(text.toLowerCase()).not.toMatch(/\b(buy|sell)\b/);
  });
});

describe("guardrail", () => {
  const base = { balance: 982, pnlToday: -18, pnlWeek: -18, tradesToday: 3, openRisk: 0, riskCommittedToday: 30, maxDailyLossPercent: 3, maxWeeklyLossPercent: 6, maxTradesPerDay: 5 };
  it("matches the spec example (-$18 of -$30, 3/5 trades, $12 left)", () => {
    const g = evaluateGuardrail(base);
    expect(g.dailyLimitAmount).toBe(30);
    expect(g.dailyLossUsed).toBe(18);
    expect(g.dailyUsedPercent).toBe(60);
    expect(g.dailyRemaining).toBe(12);
    expect(g.tradesRemaining).toBe(2);
    expect(g.state).toBe("OK");
  });
  it("stops at the daily limit with the rule wording", () => {
    const g = evaluateGuardrail({ ...base, balance: 970, pnlToday: -30 });
    expect(g.dailyLimitReached).toBe(true);
    expect(g.state).toBe("STOP");
    expect(g.messages).toContain("Daily risk limit reached.");
    expect(g.messages).toContain("Your rule says to stop trading for today.");
  });
  it("stops at max trades; open risk reduces remaining", () => {
    expect(evaluateGuardrail({ ...base, tradesToday: 5 }).tradeLimitReached).toBe(true);
    expect(evaluateGuardrail({ ...base, openRisk: 5 }).dailyRemaining).toBe(7);
  });
  it("profits don't consume the limit", () => {
    const g = evaluateGuardrail({ ...base, balance: 1032, pnlToday: 32, pnlWeek: 32 });
    expect(g.dailyLossUsed).toBe(0);
    expect(g.state).toBe("OK");
  });
});

describe("time + discipline", () => {
  it("uses Africa/Lagos day boundaries (UTC+1)", () => {
    expect(dayKey(new Date("2026-09-01T23:30:00Z"))).toBe("2026-09-02");
    expect(weekdayName(new Date("2026-09-07T10:00:00Z"))).toBe("Mon");
    expect(weekStartKey(new Date("2026-09-10T10:00:00Z"))).toBe("2026-09-07");
    expect(weekStartKey(new Date("2026-09-13T10:00:00Z"))).toBe("2026-09-07"); // Sunday
  });
  it("discipline score", () => {
    expect(disciplineScore(6, 8)).toBe(75);
    expect(disciplineScore(0, 0)).toBe(0);
  });
});
