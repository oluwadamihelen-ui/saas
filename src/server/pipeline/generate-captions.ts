import { prisma } from "@/server/db/client";

const WORDS_PER_CAPTION = 6;

/**
 * Splits a scene's narration into caption chunks and spreads them evenly
 * across the given duration. This is a simple proportional-timing heuristic
 * (not audio-aligned transcription) — accurate enough for a first pass that
 * users can then adjust manually in the editor.
 */
export async function runGenerateCaptions(sceneId: string, durationSeconds: number) {
  const scene = await prisma.scene.findUniqueOrThrow({ where: { id: sceneId } });
  const text = scene.narration?.trim();

  await prisma.caption.deleteMany({ where: { sceneId } });
  if (!text) return [];

  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += WORDS_PER_CAPTION) {
    chunks.push(words.slice(i, i + WORDS_PER_CAPTION).join(" "));
  }
  if (chunks.length === 0) return [];

  const totalMs = Math.max(1000, Math.round(durationSeconds * 1000));
  const perChunkMs = Math.floor(totalMs / chunks.length);

  const captions = await Promise.all(
    chunks.map((text, i) =>
      prisma.caption.create({
        data: {
          sceneId,
          text,
          order: i,
          startMs: i * perChunkMs,
          endMs: i === chunks.length - 1 ? totalMs : (i + 1) * perChunkMs,
        },
      })
    )
  );

  return captions;
}
