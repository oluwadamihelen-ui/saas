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
