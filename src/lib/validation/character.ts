import { z } from "zod";

export const characterSchema = z.object({
  name: z.string().trim().min(1).max(100),
  ageCategory: z.string().trim().max(50).optional(),
  genderPresentation: z.string().trim().max(50).optional(),
  appearance: z.string().trim().max(1000).optional(),
  hair: z.string().trim().max(200).optional(),
  clothing: z.string().trim().max(200).optional(),
  accessories: z.string().trim().max(200).optional(),
  personality: z.string().trim().max(1000).optional(),
  referenceImageUrl: z.string().trim().max(2000).optional(),
});

export const updateCharacterSchema = characterSchema.partial();
