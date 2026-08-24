import { z } from "zod";

export const checkoutPlanSchema = z.object({
  plan: z.enum(["STARTER", "CREATOR", "PRO"]),
});

export const creditPackCheckoutSchema = z.object({
  packId: z.enum(["small", "large"]),
});
