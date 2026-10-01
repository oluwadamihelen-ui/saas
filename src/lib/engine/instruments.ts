import type { InstrumentSpec } from "./risk";

/**
 * Starting-point contract specifications. These are COMMON defaults, not facts
 * about any particular broker — contract size, tick value and lot limits vary,
 * so presets always start as "Estimated" until the user confirms them.
 * tickValue is per 1 tick per 1 lot in the quote currency.
 */
export const INSTRUMENT_PRESETS: InstrumentSpec[] = [
  { symbol: "XAUUSD", contractSize: 100, tickSize: 0.01, tickValue: 1, minLot: 0.01, maxLot: 100, lotStep: 0.01, quoteCurrency: "USD" },
  { symbol: "XAGUSD", contractSize: 5000, tickSize: 0.001, tickValue: 5, minLot: 0.01, maxLot: 100, lotStep: 0.01, quoteCurrency: "USD" },
  { symbol: "BTCUSD", contractSize: 1, tickSize: 0.01, tickValue: 0.01, minLot: 0.01, maxLot: 50, lotStep: 0.01, quoteCurrency: "USD" },
  { symbol: "ETHUSD", contractSize: 1, tickSize: 0.01, tickValue: 0.01, minLot: 0.01, maxLot: 500, lotStep: 0.01, quoteCurrency: "USD" },
  { symbol: "EURUSD", contractSize: 100000, tickSize: 0.00001, tickValue: 1, minLot: 0.01, maxLot: 100, lotStep: 0.01, quoteCurrency: "USD" },
  { symbol: "GBPUSD", contractSize: 100000, tickSize: 0.00001, tickValue: 1, minLot: 0.01, maxLot: 100, lotStep: 0.01, quoteCurrency: "USD" },
  { symbol: "USDJPY", contractSize: 100000, tickSize: 0.001, tickValue: 0.65, minLot: 0.01, maxLot: 100, lotStep: 0.01, quoteCurrency: "USD" },
  { symbol: "US30", contractSize: 1, tickSize: 0.01, tickValue: 0.01, minLot: 0.1, maxLot: 100, lotStep: 0.1, quoteCurrency: "USD" },
  { symbol: "NAS100", contractSize: 1, tickSize: 0.01, tickValue: 0.01, minLot: 0.1, maxLot: 100, lotStep: 0.1, quoteCurrency: "USD" },
];

export const CUSTOM_SYMBOL = "CUSTOM";

export function presetFor(symbol: string): InstrumentSpec | undefined {
  return INSTRUMENT_PRESETS.find((p) => p.symbol === symbol.toUpperCase());
}

export const SYMBOLS = INSTRUMENT_PRESETS.map((p) => p.symbol);

/**
 * Rough USD→account-currency rates used ONLY to pre-fill the exchange-rate box.
 * The user can (and should) overwrite them; nothing here is a live quote.
 */
export const DEFAULT_USD_RATES: Record<string, number> = { USD: 1, NGN: 1500, EUR: 0.92, GBP: 0.79 };
export const CURRENCIES = ["USD", "NGN", "EUR", "GBP"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

export const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", NGN: "₦", EUR: "€", GBP: "£" };
