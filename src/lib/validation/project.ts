import { z } from "zod";

export const aspectRatioValues = ["RATIO_16_9", "RATIO_9_16", "RATIO_1_1"] as const;
export const visualStyleValues = [
  "MODERN_CARTOON", "STORYBOOK", "COMIC", "THREE_D_ANIMATION", "MINIMAL_ILLUSTRATION",
  "HAND_DRAWN", "CINEMATIC_CARTOON", "EDUCATIONAL", "KIDS_ANIMATION", "DOCUMENTARY_ILLUSTRATION",
] as const;

export const createProjectSchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().max(2000).optional(),
  idea: z.string().trim().max(4000).optional(),
  script: z.string().trim().max(20000).optional(),
  aspectRatio: z.enum(aspectRatioValues).optional(),
  visualStyle: z.enum(visualStyleValues).optional(),
  language: z.string().trim().max(20).optional(),
  audience: z.string().trim().max(100).optional(),
  targetLengthSeconds: z.number().int().positive().max(3600).optional(),
});
