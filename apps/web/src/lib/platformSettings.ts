import { prisma } from "./db";

export class InvalidPriceRangeError extends Error {}

export interface PlatformSettingsInput {
  publisherRevenueShareBps: number;
  settlementPeriodDays: number;
  payoutMinimumCoins: number;
  payoutCoinValueCents: number;
  payoutCurrency: string;
  minMovieCoinPrice: number;
  maxMovieCoinPrice: number;
  minEpisodeCoinPrice: number;
  maxEpisodeCoinPrice: number;
  minSceneCoinPrice: number;
  maxSceneCoinPrice: number;
  doeCostPerReferenceImage: number;
  doeCostPerVideoSecond: number;
  doeCostPerTextGeneration: number;
  doeCostPerVoice100Chars: number;
  doeCostPerAudioSecond: number;
}

/**
 * Was, until this phase, editable only via direct Prisma Studio access —
 * these values (revenue share, price ranges, payout economics) drive
 * every price/split calculation in monetization.ts and payouts.ts, so a
 * bad value here is a real operational risk, not just a cosmetic one.
 * Each min/max pair is validated here rather than left to the database or
 * the caller, since a swapped min/max would silently make every price in
 * that range unselectable.
 */
export async function updatePlatformSettings(input: PlatformSettingsInput) {
  if (input.minMovieCoinPrice > input.maxMovieCoinPrice) throw new InvalidPriceRangeError("Movie price minimum can't exceed its maximum.");
  if (input.minEpisodeCoinPrice > input.maxEpisodeCoinPrice) throw new InvalidPriceRangeError("Episode price minimum can't exceed its maximum.");
  if (input.minSceneCoinPrice > input.maxSceneCoinPrice) throw new InvalidPriceRangeError("Scene price minimum can't exceed its maximum.");

  return prisma.platformSettings.update({ where: { id: "singleton" }, data: input });
}
