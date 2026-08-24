import type { PlanId } from "@/generated/prisma/enums";

// Central configuration for plan limits and credit costs.
// Prices are intentionally left out until business decisions are made —
// wire these into Stripe Price IDs in Phase E.
export type PlanConfig = {
  id: PlanId;
  name: string;
  monthlyCredits: number;
  maxVideoLengthSeconds: number;
  maxExportResolution: "720p" | "1080p";
  availableStyles: "basic" | "all";
  priorityGeneration: boolean;
  commercialUsage: boolean;
  storageGb: number;
};

export const PLANS: Record<PlanId, PlanConfig> = {
  FREE: {
    id: "FREE",
    name: "Free",
    monthlyCredits: 50,
    maxVideoLengthSeconds: 60,
    maxExportResolution: "720p",
    availableStyles: "basic",
    priorityGeneration: false,
    commercialUsage: false,
    storageGb: 1,
  },
  STARTER: {
    id: "STARTER",
    name: "Starter",
    monthlyCredits: 300,
    maxVideoLengthSeconds: 180,
    maxExportResolution: "1080p",
    availableStyles: "all",
    priorityGeneration: false,
    commercialUsage: false,
    storageGb: 10,
  },
  CREATOR: {
    id: "CREATOR",
    name: "Creator",
    monthlyCredits: 1000,
    maxVideoLengthSeconds: 420,
    maxExportResolution: "1080p",
    availableStyles: "all",
    priorityGeneration: true,
    commercialUsage: true,
    storageGb: 50,
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    monthlyCredits: 3000,
    maxVideoLengthSeconds: 900,
    maxExportResolution: "1080p",
    availableStyles: "all",
    priorityGeneration: true,
    commercialUsage: true,
    storageGb: 200,
  },
};

// Credit cost per expensive operation. Tune as real provider costs become known.
export const CREDIT_COSTS = {
  SCRIPT_GENERATION: 3,
  STORYBOARD_GENERATION: 5,
  IMAGE_GENERATION: 4,
  VIDEO_GENERATION: 15,
  VOICE_GENERATION: 3,
  MUSIC_GENERATION: 5,
  RENDER: 10,
} as const;

export const SIGNUP_GRANT_CREDITS = 50;

// Every paid plan needs a Stripe Price ID configured via env before it can
// be purchased — FREE never has one, since it isn't a Stripe subscription.
const PLAN_PRICE_ENV: Partial<Record<PlanId, string | undefined>> = {
  STARTER: process.env.STRIPE_PRICE_STARTER,
  CREATOR: process.env.STRIPE_PRICE_CREATOR,
  PRO: process.env.STRIPE_PRICE_PRO,
};

export function getStripePriceIdForPlan(plan: PlanId): string | null {
  return PLAN_PRICE_ENV[plan] || null;
}

/** Reverse lookup used by the Stripe webhook to map a subscription's price back to our PlanId. */
export function getPlanForStripePriceId(priceId: string | undefined | null): PlanId | null {
  if (!priceId) return null;
  const entry = (Object.entries(PLAN_PRICE_ENV) as [PlanId, string | undefined][]).find(
    ([, envPriceId]) => envPriceId === priceId
  );
  return entry?.[0] ?? null;
}

export type CreditPack = {
  id: "small" | "large";
  name: string;
  credits: number;
};

export const CREDIT_PACKS: CreditPack[] = [
  { id: "small", name: "Small top-up", credits: 200 },
  { id: "large", name: "Large top-up", credits: 1000 },
];

const CREDIT_PACK_PRICE_ENV: Record<CreditPack["id"], string | undefined> = {
  small: process.env.STRIPE_PRICE_CREDIT_PACK_SMALL,
  large: process.env.STRIPE_PRICE_CREDIT_PACK_LARGE,
};

export function getStripePriceIdForCreditPack(packId: CreditPack["id"]): string | null {
  return CREDIT_PACK_PRICE_ENV[packId] || null;
}
