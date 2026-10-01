import { z } from "zod";

/**
 * Platform-wide marketplace settings. Defaults live here; admins override them in the DB.
 * Nothing about commission, price limits or fees is hard-coded elsewhere.
 */
export const settingsSchema = z.object({
  commissionPercent: z.number().min(0).max(60),
  processingFeePercent: z.number().min(0).max(20),
  processingFeeFixedCents: z.number().int().min(0).max(1000),
  taxPercent: z.number().min(0).max(40),
  feeBearer: z.enum(["creator", "platform"]),
  holdbackDays: z.number().int().min(0).max(90),
  minPayoutUsdCents: z.number().int().min(100).max(1_000_000),
  ngnPerUsd: z.number().min(1).max(100_000),
  priceLimits: z.object({
    ONE_TIME: z.object({ minCents: z.number().int().min(0), maxCents: z.number().int().min(0) }),
    MONTHLY: z.object({ minCents: z.number().int().min(0), maxCents: z.number().int().min(0) }),
    YEARLY: z.object({ minCents: z.number().int().min(0), maxCents: z.number().int().min(0) }),
  }),
  minEvidenceTrades: z.number().int().min(0).max(1000),
});
export type MarketSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: MarketSettings = {
  commissionPercent: 20,
  processingFeePercent: 2,
  processingFeeFixedCents: 0,
  taxPercent: 0,
  feeBearer: "creator",
  holdbackDays: 7,
  minPayoutUsdCents: 5000,
  ngnPerUsd: 1500,
  priceLimits: {
    ONE_TIME: { minCents: 500, maxCents: 50000 },
    MONTHLY: { minCents: 300, maxCents: 20000 },
    YEARLY: { minCents: 2000, maxCents: 200000 },
  },
  minEvidenceTrades: 30,
};

export const DEFAULT_CATEGORIES: { slug: string; name: string }[] = [
  { slug: "forex", name: "Forex" }, { slug: "gold", name: "Gold" }, { slug: "crypto", name: "Crypto" }, { slug: "indices", name: "Indices" },
  { slug: "scalping", name: "Scalping" }, { slug: "swing-trading", name: "Swing Trading" }, { slug: "trend-following", name: "Trend Following" },
  { slug: "momentum", name: "Momentum" }, { slug: "breakout", name: "Breakout" }, { slug: "price-action", name: "Price Action" }, { slug: "custom", name: "Custom" },
];

/** Merge stored overrides over the defaults and validate; invalid stored data falls back to defaults. */
export function mergeSettings(stored: Record<string, unknown> | null | undefined): MarketSettings {
  const merged = { ...DEFAULT_SETTINGS, ...(stored ?? {}), priceLimits: { ...DEFAULT_SETTINGS.priceLimits, ...((stored as { priceLimits?: object } | null | undefined)?.priceLimits ?? {}) } };
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}
