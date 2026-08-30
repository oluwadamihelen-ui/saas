import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name is too short").max(120),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().min(7).max(20).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
