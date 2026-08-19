import { z } from "zod";

export const updateSceneSchema = z.object({
  title: z.string().trim().min(1).max(150).optional(),
  narration: z.string().trim().max(4000).optional(),
  visualPrompt: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(150).optional(),
  camera: z.string().trim().max(150).optional(),
  transition: z.string().trim().max(50).optional(),
  durationSeconds: z.number().int().min(1).max(120).optional(),
});

export const reorderScenesSchema = z.object({
  sceneIds: z.array(z.string().min(1)).min(1),
});
