import { roundTo } from "./risk";

/**
 * Prop-firm style rules. These are the USER'S rules, tracked for them.
 * Firms change their terms and measure drawdown differently (balance vs equity,
 * daily reset times, trailing caps) — templates are editable starting points and
 * everything is computed from closed trades only, so always check your firm's current rules.
 */
export type DrawdownType = "STATIC" | "TRAILING";

export interface RuleValues {
  defaultRiskPercent: number;
  maxRiskPerTrade: number;
  maxDailyLossPercent: number;
  maxWeeklyLossPercent: number;
  maxTradesPerDay: number;
  minRiskReward: number;
  maxTotalDrawdownPercent: number | null;
  drawdownType: DrawdownType;
  profitTargetPercent: number | null;
}

export interface RuleTemplate {
  key: string;
  name: string;
  description: string;
  rules: RuleValues;
}

const common = { defaultRiskPercent: 0.5, maxRiskPerTrade: 1, maxTradesPerDay: 5, minRiskReward: 1.5 };

export const RULE_TEMPLATES: RuleTemplate[] = [
  {
    key: "two_step",
    name: "Typical 2-step challenge",
    description: "5% daily loss, 10% fixed max drawdown, 10% profit target.",
    rules: { ...common, maxDailyLossPercent: 5, maxWeeklyLossPercent: 8, maxTotalDrawdownPercent: 10, drawdownType: "STATIC", profitTargetPercent: 10 },
  },
  {
    key: "one_step",
    name: "Typical 1-step challenge",
    description: "3% daily loss, 6% trailing max drawdown, 10% profit target.",
    rules: { ...common, maxDailyLossPercent: 3, maxWeeklyLossPercent: 5, maxTotalDrawdownPercent: 6, drawdownType: "TRAILING", profitTargetPercent: 10 },
  },
  {
    key: "funded",
    name: "Funded account (conservative)",
    description: "Tighter personal limits on top of a 6% fixed drawdown. No profit target.",
    rules: { ...common, defaultRiskPercent: 0.5, maxRiskPerTrade: 0.75, maxDailyLossPercent: 2, maxWeeklyLossPercent: 4, maxTotalDrawdownPercent: 6, drawdownType: "STATIC", profitTargetPercent: null },
  },
  {
    key: "strict_personal",
    name: "Strict personal rules",
    description: "No firm — just small risk and early stops: 0.5% per trade, 2% daily.",
    rules: { ...common, defaultRiskPercent: 0.5, maxRiskPerTrade: 0.5, maxDailyLossPercent: 2, maxWeeklyLossPercent: 4, maxTotalDrawdownPercent: null, drawdownType: "STATIC", profitTargetPercent: null },
  },
];

export const TEMPLATE_KEYS = RULE_TEMPLATES.map((t) => t.key);
export const templateByKey = (k: string | null | undefined) => RULE_TEMPLATES.find((t) => t.key === k);

export interface ChallengeInput {
  startingBalance: number;
  /** Current closed-trade balance. */
  balance: number;
  /** Highest closed-trade balance so far (≥ startingBalance). */
  peakBalance: number;
  maxTotalDrawdownPercent: number | null;
  drawdownType: DrawdownType;
  profitTargetPercent: number | null;
}

export interface ChallengeStatus {
  enabled: boolean;
  drawdownType: DrawdownType;
  /** Balance at/below which the max-drawdown rule is broken. */
  floor: number | null;
  /** Money you can still lose before the floor. */
  room: number | null;
  drawdownLimitAmount: number | null;
  drawdownUsedPercent: number; // of the allowed drawdown, 0–100+
  breached: boolean;
  target: number | null;
  targetProgressPercent: number | null;
  targetReached: boolean;
  state: "OK" | "DANGER" | "BREACHED";
  messages: string[];
}

export function evaluateChallenge(i: ChallengeInput): ChallengeStatus {
  const none: ChallengeStatus = { enabled: false, drawdownType: i.drawdownType, floor: null, room: null, drawdownLimitAmount: null, drawdownUsedPercent: 0, breached: false, target: null, targetProgressPercent: null, targetReached: false, state: "OK", messages: [] };
  if (!(i.startingBalance > 0)) return none;

  const target = i.profitTargetPercent && i.profitTargetPercent > 0 ? i.startingBalance * (1 + i.profitTargetPercent / 100) : null;
  const targetProgress = target ? Math.max(0, ((i.balance - i.startingBalance) / (target - i.startingBalance)) * 100) : null;
  const base = { ...none, target: target === null ? null : roundTo(target, 2), targetProgressPercent: targetProgress === null ? null : roundTo(targetProgress, 1), targetReached: target !== null && i.balance >= target - 1e-9 };

  if (!i.maxTotalDrawdownPercent || i.maxTotalDrawdownPercent <= 0) return { ...base, enabled: target !== null };

  const limitAmt = (i.startingBalance * i.maxTotalDrawdownPercent) / 100;
  // STATIC: fixed floor from the starting balance. TRAILING: floor follows the highest balance reached.
  const anchor = i.drawdownType === "TRAILING" ? Math.max(i.peakBalance, i.startingBalance) : i.startingBalance;
  const floor = anchor - limitAmt;
  const room = Math.max(0, i.balance - floor);
  const used = ((anchor - i.balance) / limitAmt) * 100;
  const breached = i.balance <= floor + 1e-9;
  const usedClamped = Math.max(0, used);

  const messages: string[] = [];
  if (breached) messages.push("Maximum drawdown limit reached.", "Your rule says to stop trading.");
  else if (usedClamped >= 80) messages.push(`You have used ${Math.round(usedClamped)}% of your maximum drawdown.`);
  if (base.targetReached && !breached) messages.push("Profit target reached.");

  return {
    ...base,
    enabled: true,
    floor: roundTo(floor, 2),
    room: roundTo(room, 2),
    drawdownLimitAmount: roundTo(limitAmt, 2),
    drawdownUsedPercent: roundTo(usedClamped, 1),
    breached,
    state: breached ? "BREACHED" : usedClamped >= 80 ? "DANGER" : "OK",
    messages,
  };
}

/** Closed-trade high-water mark, including the starting balance. */
export function peakBalance(startingBalance: number, pnlsInOrder: number[]): number {
  let bal = startingBalance;
  let peak = startingBalance;
  for (const p of pnlsInOrder) {
    bal += p;
    if (bal > peak) peak = bal;
  }
  return peak;
}
