/**
 * Plan limits and pricing live here so they can be changed (or A/B tested)
 * without touching feature code. Amounts are in major units.
 */
export type PlanKey = "FREE" | "PRO";

export interface PlanLimits {
  maxTrades: number; // per user, lifetime (Infinity = unlimited)
  maxAccounts: number;
  screenshots: boolean;
  advancedAnalytics: boolean; // breakdowns, drawdown curve, behaviour insights
  advancedRules: boolean; // weekly limit, custom risk bands, min R:R
  exportData: boolean;
  tradingViewTools: boolean;
  lab: { indicators: number; strategies: number; datasets: number; backtests: number; optimization: boolean };
}

export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  FREE: { maxTrades: 30, maxAccounts: 1, screenshots: false, advancedAnalytics: false, advancedRules: false, exportData: false, tradingViewTools: false, lab: { indicators: 2, strategies: 2, datasets: 2, backtests: 10, optimization: false } },
  PRO: { maxTrades: Infinity, maxAccounts: 10, screenshots: true, advancedAnalytics: true, advancedRules: true, exportData: true, tradingViewTools: true, lab: { indicators: 100, strategies: 200, datasets: 50, backtests: 2000, optimization: true } },
};

export type BillingIntervalKey = "MONTHLY" | "ANNUAL";

export const PRICING: Record<BillingIntervalKey, { label: string; usd: number; ngn: number; days: number }> = {
  MONTHLY: { label: "Pro Monthly", usd: 5, ngn: 7500, days: 31 },
  ANNUAL: { label: "Pro Annual", usd: 49, ngn: 73500, days: 366 },
};

export const PRO_FEATURES = [
  "Unlimited trades",
  "Advanced analytics & drawdown curve",
  "Behaviour insights",
  "Multiple accounts",
  "Advanced risk rules (weekly limit, custom risk levels)",
  "Screenshot storage",
  "TradingView / Pine Script tools",
  "CSV export",
  "Indicator Lab: unlimited backtests, parameter testing & walk-forward",
];

export const FREE_FEATURES = [
  "Position size & risk calculators",
  "Trade journal (up to 30 trades)",
  "Basic analytics",
  "Daily risk guardrail",
  "Indicator Lab (2 indicators, basic backtests)",
  "Sell indicators in the marketplace",
  "Pre-trade checklist",
];
