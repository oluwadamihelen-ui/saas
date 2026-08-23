import { z } from "zod";

export const startRenderSchema = z.object({
  resolution: z.enum(["R_720P", "R_1080P"]).default("R_1080P"),
});
