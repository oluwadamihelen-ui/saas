import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().email(),
  subject: z.string().trim().max(150).optional(),
  message: z.string().trim().min(10).max(4000),
});
