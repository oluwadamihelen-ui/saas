import { z } from "zod";

export const sceneVoiceSettingsSchema = z.object({
  voicePresetId: z.string().min(1).nullable().optional(),
  voiceSpeed: z.number().min(0.5).max(2).optional(),
  voicePitch: z.number().min(0.5).max(2).optional(),
});

export const attachProjectMusicSchema = z.object({
  musicTrackId: z.string().min(1),
  volume: z.number().min(0).max(1).optional(),
  fadeInMs: z.number().int().min(0).max(10000).optional(),
  fadeOutMs: z.number().int().min(0).max(10000).optional(),
  loop: z.boolean().optional(),
  duckUnderVoice: z.boolean().optional(),
});

export const captionSchema = z.object({
  text: z.string().trim().min(1).max(300),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
});
