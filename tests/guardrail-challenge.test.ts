import { describe, expect, it } from "vitest";
import { computeGuardrail, type TradeRow } from "@/lib/data";

const NOW = new Date("2026-10-10T12:00:00Z");
function trade(daysAgo: number, pnl: number, risk = 100): TradeRow {
  return { id: String(Math.random()), openedAt: new Date(NOW.getTime() - daysAgo * 86_400_000), instrument: "XAUUSD", direction: "LONG", result: pnl > 0 ? "WIN" : "LOSS", pnl, rMultiple: pnl / risk, riskPercent: 1, riskAmount: risk, tags: [], _count: { screenshots: 0 } } as unknown as TradeRow;
}
const args = (rs: Record<string, unknown> = {}) => ({ timezone: "Africa/Lagos", startingBalance: 10000, riskSettings: { maxDailyLossPercent: 5, maxWeeklyLossPercent: 8, maxTradesPerDay: 10, maxTotalDrawdownPercent: 10, drawdownType: "STATIC", profitTargetPercent: 10, ...rs } });

describe("computeGuardrail + challenge rules", () => {
  it("stays OK and reports drawdown/target progress", () => {
    const { status } = computeGuardrail(args(), [trade(3, 300), trade(2, -100)], NOW);
    expect(status.state).toBe("OK");
    expect(status.challenge?.floor).toBe(9000);
    expect(status.challenge?.targetProgressPercent).toBe(20);
  });
  it("turns STOP when the max drawdown is breached even if today has room", () => {
    const { status } = computeGuardrail(args(), [trade(20, -600), trade(15, -500)], NOW); // balance 8900 < 9000 floor
    expect(status.dailyLimitReached).toBe(false);
    expect(status.state).toBe("STOP");
    expect(status.messages).toContain("Maximum drawdown limit reached.");
  });
  it("turns CAUTION near the floor and caps remaining daily risk at the room left", () => {
    const { status } = computeGuardrail(args(), [trade(20, -850)], NOW); // balance 9150; room 150; daily limit ~457
    expect(status.state).toBe("CAUTION");
    expect(status.dailyRemaining).toBe(150);
  });
  it("trailing floor follows the peak", () => {
    const { status } = computeGuardrail(args({ drawdownType: "TRAILING", maxTotalDrawdownPercent: 6 }), [trade(20, 1000), trade(15, -700)], NOW); // peak 11000, floor 10400, bal 10300
    expect(status.challenge?.floor).toBe(10400);
    expect(status.state).toBe("STOP");
  });
  it("without challenge fields behaves exactly like before", () => {
    const { status } = computeGuardrail(args({ maxTotalDrawdownPercent: null, profitTargetPercent: null }), [trade(1, -50)], NOW);
    expect(status.challenge).toBeUndefined();
  });
});
