/**
 * Default voice assignment for dialogue synthesis. These are ElevenLabs'
 * own premade voice IDs, present by default on every ElevenLabs account —
 * not fabricated data, just a reasonable starting assignment until a user
 * points a character at a custom or cloned voice via Character.voiceId
 * (spec §28: "consistent voice identity" per character).
 */
const DEFAULT_VOICE_IDS = {
  femaleA: "21m00Tcm4TlvDq8ikWAM", // "Rachel"
  femaleB: "EXAVITQu4vr4xnSDxMaL", // "Bella"
  maleA: "ErXwobaYiN019PkySvjV", // "Antoni"
  maleB: "TxGEqnHWrfWFTfGW9XjX", // "Josh"
} as const;

/** Deterministic (same character always gets the same default) so voice identity stays stable across regenerations. */
export function assignDefaultVoiceId(characterId: string, gender: string | null): string {
  const pool = gender?.toLowerCase().startsWith("f") ? [DEFAULT_VOICE_IDS.femaleA, DEFAULT_VOICE_IDS.femaleB] : [DEFAULT_VOICE_IDS.maleA, DEFAULT_VOICE_IDS.maleB];

  let hash = 0;
  for (let i = 0; i < characterId.length; i++) {
    hash = (hash * 31 + characterId.charCodeAt(i)) >>> 0;
  }
  return pool[hash % pool.length]!;
}
