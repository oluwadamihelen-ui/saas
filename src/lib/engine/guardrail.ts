import { roundTo } from "./risk";
import type { ChallengeStatus } from "./challenge";

export interface GuardrailInput {
  /** Current account balance. */
  balance: number;
  /** Realised P&L today (negative = loss). */
  pnlToday: number;
  /** Realised P&L this week (Mon–Sun). */
  pnlWeek: number;
  tradesToday: number;
  /** Risk (money) on trades that are still open. */
  openRisk: number;
  /** Sum of risk amounts committed today (open + closed). */
  riskCommittedToday: number;
  maxDailyLossPercent: number;
  maxWeeklyLossPercent: number;
  maxTradesPerDay: number;
}

export interface GuardrailStatus {
  dailyLimitAmount: number;
  dailyLossUsed: number;
  dailyUsedPercent: number; // of the limit, 0–100+
  dailyRemaining: number;
  weeklyLimitAmount: number;
  weeklyLossUsed: number;
  weeklyUsedPercent: number;
  weeklyRemaining: number;
  tradesRemaining: number;
  riskTodayPercent: number; // % of balance committed today
  dailyLimitReached: boolean;
  weeklyLimitReached: boolean;
  tradeLimitReached: boolean;
  state: "OK" | "CAUTION" | "STOP";
  messages: string[];
  /** Prop-firm / challenge rules (max drawdown, profit target), when the user has set them. */
  challenge?: ChallengeStatus;
}

/** Limits are measured against the balance at the START of the day/week (balance − P&L so far). */
export function evaluateGuardrail(i: GuardrailInput): GuardrailStatus {
  const dayStartBal = Math.max(i.balance - i.pnlToday, 0.01);
  const weekStartBal = Math.max(i.balance - i.pnlWeek, 0.01);
  const dailyLimitAmount = (dayStartBal * i.maxDailyLossPercent) / 100;
  const weeklyLimitAmount = (weekStartBal * i.maxWeeklyLossPercent) / 100;
  const dailyLossUsed = Math.max(0, -i.pnlToday);
  const weeklyLossUsed = Math.max(0, -i.pnlWeek);

  const dailyLimitReached = dailyLimitAmount > 0 && dailyLossUsed >= dailyLimitAmount - 1e-9;
  const weeklyLimitReached = weeklyLimitAmount > 0 && weeklyLossUsed >= weeklyLimitAmount - 1e-9;
  const tradeLimitReached = i.tradesToday >= i.maxTradesPerDay;

  const dailyUsedPercent = dailyLimitAmount > 0 ? (dailyLossUsed / dailyLimitAmount) * 100 : 0;
  const weeklyUsedPercent = weeklyLimitAmount > 0 ? (weeklyLossUsed / weeklyLimitAmount) * 100 : 0;

  const messages: string[] = [];
  if (dailyLimitReached) {
    messages.push("Daily risk limit reached.", "Your rule says to stop trading for today.");
  }
  if (weeklyLimitReached) messages.push("Weekly loss limit reached. Your rule says to stop trading until next week.");
  if (tradeLimitReached && !dailyLimitReached) messages.push("You have used all your trades for today. Your rule says to stop.");

  const stop = dailyLimitReached || weeklyLimitReached || tradeLimitReached;
  const caution = !stop && (dailyUsedPercent >= 70 || weeklyUsedPercent >= 70 || i.tradesToday >= i.maxTradesPerDay - 1);
  if (caution) messages.push("You are close to one of your own limits.");

  return {
    dailyLimitAmount: roundTo(dailyLimitAmount, 2),
    dailyLossUsed: roundTo(dailyLossUsed, 2),
    dailyUsedPercent: roundTo(dailyUsedPercent, 1),
    dailyRemaining: roundTo(Math.max(0, dailyLimitAmount - dailyLossUsed - i.openRisk), 2),
    weeklyLimitAmount: roundTo(weeklyLimitAmount, 2),
    weeklyLossUsed: roundTo(weeklyLossUsed, 2),
    weeklyUsedPercent: roundTo(weeklyUsedPercent, 1),
    weeklyRemaining: roundTo(Math.max(0, weeklyLimitAmount - weeklyLossUsed), 2),
    tradesRemaining: Math.max(0, i.maxTradesPerDay - i.tradesToday),
    riskTodayPercent: roundTo((i.riskCommittedToday / dayStartBal) * 100, 2),
    dailyLimitReached,
    weeklyLimitReached,
    tradeLimitReached,
    state: stop ? "STOP" : caution ? "CAUTION" : "OK",
    messages,
  };
}

export const DEFAULT_CHECKLIST = [
  "I know my entry",
  "I have a stop loss",
  "My position size was calculated",
  "Risk is within my limit",
  "Risk/reward meets my personal rule",
  "I am not revenge trading",
  "I am not increasing size after a loss",
  "I have a written reason for the trade",
];

/** Pre-trade discipline score: % of checklist items ticked. Behaviour tracking only — not a prediction. */
export function disciplineScore(checked: number, total: number): number {
  if (total <= 0) return 0;
  return roundTo((checked / total) * 100, 0);
}
