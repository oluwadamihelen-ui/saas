import { z } from "zod";

export const requestResetSchema = z.object({
  email: z.string().email(),
});

export const confirmResetSchema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
  password: z.string().min(8).max(100),
});
