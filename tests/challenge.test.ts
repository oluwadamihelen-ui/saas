import { describe, expect, it } from "vitest";
import { RULE_TEMPLATES, TEMPLATE_KEYS, evaluateChallenge, peakBalance, templateByKey } from "@/lib/engine/challenge";
import { rulesSchema } from "@/lib/validation";

const base = { startingBalance: 10000, balance: 10000, peakBalance: 10000, maxTotalDrawdownPercent: 10, drawdownType: "STATIC" as const, profitTargetPercent: 10 };

describe("static max drawdown", () => {
  it("floor is fixed at start − limit", () => {
    const c = evaluateChallenge({ ...base, balance: 9500, peakBalance: 10400 });
    expect(c.floor).toBe(9000);
    expect(c.room).toBe(500);
    expect(c.drawdownUsedPercent).toBe(50);
    expect(c.state).toBe("OK");
  });
  it("DANGER at 80% used, BREACHED at/below the floor with the rule wording", () => {
    expect(evaluateChallenge({ ...base, balance: 9150 }).state).toBe("DANGER");
    const b = evaluateChallenge({ ...base, balance: 9000 });
    expect(b.breached).toBe(true);
    expect(b.state).toBe("BREACHED");
    expect(b.room).toBe(0);
    expect(b.messages).toContain("Maximum drawdown limit reached.");
    expect(b.messages).toContain("Your rule says to stop trading.");
    expect(evaluateChallenge({ ...base, balance: 8000 }).breached).toBe(true);
  });
  it("profits don't move a static floor", () => {
    const c = evaluateChallenge({ ...base, balance: 11000, peakBalance: 11000 });
    expect(c.floor).toBe(9000);
    expect(c.drawdownUsedPercent).toBe(0);
  });
});

describe("trailing max drawdown", () => {
  it("floor follows the high-water mark", () => {
    const c = evaluateChallenge({ ...base, drawdownType: "TRAILING", maxTotalDrawdownPercent: 6, balance: 10300, peakBalance: 10800 });
    expect(c.floor).toBe(10200);
    expect(c.room).toBe(100);
    expect(c.drawdownUsedPercent).toBe(83.3);
    expect(c.state).toBe("DANGER");
  });
  it("breaches when falling to the trailed floor even though above the start", () => {
    const c = evaluateChallenge({ ...base, drawdownType: "TRAILING", maxTotalDrawdownPercent: 6, balance: 10200, peakBalance: 10800 });
    expect(c.breached).toBe(true);
  });
});

describe("profit target & disabled states", () => {
  it("tracks progress and reaching the target", () => {
    expect(evaluateChallenge({ ...base, balance: 10500 }).targetProgressPercent).toBe(50);
    const r = evaluateChallenge({ ...base, balance: 11000, peakBalance: 11000 });
    expect(r.targetReached).toBe(true);
    expect(r.messages).toContain("Profit target reached.");
    expect(evaluateChallenge({ ...base, balance: 9800 }).targetProgressPercent).toBe(0);
  });
  it("is disabled without limits; invalid starting balance is inert", () => {
    expect(evaluateChallenge({ ...base, maxTotalDrawdownPercent: null, profitTargetPercent: null }).enabled).toBe(false);
    expect(evaluateChallenge({ ...base, startingBalance: 0 }).enabled).toBe(false);
    expect(evaluateChallenge({ ...base, maxTotalDrawdownPercent: null }).enabled).toBe(true); // target only
  });
  it("peakBalance", () => {
    expect(peakBalance(1000, [100, -50, 200, -300])).toBe(1250);
    expect(peakBalance(1000, [-100])).toBe(1000);
    expect(peakBalance(1000, [])).toBe(1000);
  });
});

describe("templates", () => {
  it("every template passes the same validation as the rules form", () => {
    for (const t of RULE_TEMPLATES) {
      const r = rulesSchema.safeParse({ ...t.rules, lowMax: 1, moderateMax: 2, highMax: 5 });
      expect(r.success, t.key).toBe(true);
      expect(t.rules.maxRiskPerTrade).toBeLessThanOrEqual(t.rules.maxDailyLossPercent);
      expect(t.rules.maxDailyLossPercent).toBeLessThanOrEqual(t.rules.maxWeeklyLossPercent);
    }
  });
  it("keys are unique and look-up works", () => {
    expect(new Set(TEMPLATE_KEYS).size).toBe(TEMPLATE_KEYS.length);
    expect(templateByKey("two_step")?.rules.maxTotalDrawdownPercent).toBe(10);
    expect(templateByKey("nope")).toBeUndefined();
  });
  it("makes no claims about specific firms or outcomes", () => {
    const text = RULE_TEMPLATES.map((t) => `${t.name} ${t.description}`).join(" ").toLowerCase();
    expect(text).not.toMatch(/ftmo|funded ?next|myforexfunds|guarantee|pass(es)? (the )?challenge/);
  });
});
