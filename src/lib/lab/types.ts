/** Shared types for the Indicator Lab. Pure data — no I/O. */
export interface Candle {
  /** Open time, ms since epoch (UTC). */
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export type Num = number | { param: string };

export type PriceField = "open" | "high" | "low" | "close";

export type Operand =
  | { k: "price"; f: PriceField }
  | { k: "ind"; name: IndicatorName; period: Num; src?: PriceField }
  | { k: "num"; v: Num };

export type IndicatorName = "sma" | "ema" | "rsi" | "atr" | "highest" | "lowest";
export const INDICATOR_NAMES: IndicatorName[] = ["sma", "ema", "rsi", "atr", "highest", "lowest"];

export type CompareOp = "crosses_above" | "crosses_below" | "gt" | "lt" | "gte" | "lte";

export interface Cond {
  l: Operand;
  op: CompareOp;
  r: Operand;
}

export type StopType = "pips" | "distance" | "atr" | "percent";
export type TargetType = "none" | "rr" | "pips" | "distance" | "atr" | "percent";

export const LAB_SESSIONS = ["Asian", "London", "London/NY overlap", "New York", "Off-hours"] as const;
export type LabSession = (typeof LAB_SESSIONS)[number];

/**
 * The user's EXPLICIT rules. An indicator alone is not a strategy: nothing is
 * traded unless entry conditions are defined here.
 */
export interface StrategyDef {
  direction: "both" | "long" | "short";
  /** All conditions must be true (AND) on the bar's close. Empty array = that side is disabled. */
  longEntry: Cond[];
  shortEntry: Cond[];
  longExit: Cond[];
  shortExit: Cond[];
  exitOnOpposite: boolean;
  maxBarsInTrade: number | null;
  stop: { type: StopType; value: Num; atrPeriod?: Num };
  target: { type: TargetType; value: Num; atrPeriod?: Num };
  /** Only take entries inside these sessions (null = any). */
  sessions: LabSession[] | null;
  /** Default values for named parameters ({ param: "fast" } references). */
  defaults?: Record<string, number>;
}

export interface BacktestConfig {
  symbol: string;
  timeframe: string;
  fromTs: number;
  toTs: number;
  initialBalance: number;
  riskPercent: number;
  /** Full spread in price units. Long entries pay +spread/2, short entries -spread/2. */
  spread: number;
  /** Adverse slippage in price units applied to every fill. */
  slippage: number;
  /** Account currency per lot per side (round-turn = 2×). */
  commissionPerLot: number;
  pipSize: number;
  spec: {
    contractSize: number;
    tickSize: number;
    tickValue: number;
    minLot: number;
    maxLot: number;
    lotStep: number;
    quoteCurrency: string;
  };
  fxRate: number;
  accountCurrency: string;
  params?: Record<string, number>;
}

export type ExitReason = "stop" | "take_profit" | "signal" | "opposite" | "max_bars" | "end_of_data";

export interface SimTrade {
  entryTime: number;
  exitTime: number;
  direction: "LONG" | "SHORT";
  entry: number;
  exit: number;
  stop: number;
  target: number | null;
  lots: number;
  riskAmount: number;
  commission: number;
  pnl: number;
  rMultiple: number;
  exitReason: ExitReason;
  barsHeld: number;
  session: LabSession;
}
