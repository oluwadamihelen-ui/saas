import type { BacktestConfig } from "./types";

export const EXECUTION_MODEL_NOTE =
  "Signals are read at bar close and filled at the next bar's open. Candles are treated as mid prices; spread and slippage are applied against the trader on every fill. If a stop and target are both touched inside one bar, the stop is assumed to hit first. One position at a time; risk is taken from the current simulated balance.";

export interface AssumptionRow { label: string; value: string }

/** Every public/lab backtest shows ALL of these — there is deliberately no way to hide an assumption. */
export function assumptionRows(args: { config: BacktestConfig; dataSource: string; sampleType: string; tradeCount: number; synthetic: boolean; imported?: boolean }): AssumptionRow[] {
  const c = args.config;
  const d = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const sample = args.sampleType === "IN_SAMPLE" ? "In-sample (optimization period)" : args.sampleType === "OUT_OF_SAMPLE" ? "Out-of-sample" : "Full period (single test, no sample split)";
  return [
    { label: "Instrument", value: c.symbol },
    { label: "Timeframe", value: c.timeframe },
    { label: "Period tested", value: `${d(c.fromTs)} → ${d(c.toTs)}` },
    { label: "Sample", value: sample },
    { label: "Data source", value: args.synthetic ? "SYNTHETIC DEMO DATA (not real prices)" : args.dataSource },
    { label: "Starting balance", value: `${c.initialBalance.toLocaleString("en-US")} ${c.accountCurrency}` },
    { label: "Risk model", value: `${c.riskPercent}% of current balance per trade (compounding), lot size rounded down to the lot step` },
    { label: "Spread assumption", value: args.imported ? "As configured in TradingView (not verified)" : `${c.spread} price units` },
    { label: "Commission assumption", value: args.imported ? "As configured in TradingView (not verified)" : `${c.commissionPerLot} ${c.accountCurrency} per lot, per side` },
    { label: "Slippage assumption", value: args.imported ? "As configured in TradingView (not verified)" : `${c.slippage} price units, against the trader` },
    { label: "Number of trades", value: String(args.tradeCount) },
    ...(c.params && Object.keys(c.params).length ? [{ label: "Parameters", value: Object.entries(c.params).map(([k, v]) => `${k}=${v}`).join(", ") }] : []),
  ];
}
