import { prisma } from "../src/server/db/client";
import { getVoiceProvider, getMusicProvider } from "../src/server/providers";
import { getStorageProvider } from "../src/server/storage";

const VOICES: Array<{
  name: string;
  style: "WARM" | "ENERGETIC" | "DRAMATIC" | "PROFESSIONAL" | "EDUCATIONAL" | "FRIENDLY" | "STORYTELLING";
  language: string;
  accent: string;
  gender: string;
}> = [
  { name: "Aria", style: "WARM", language: "en", accent: "US", gender: "Female" },
  { name: "Milo", style: "WARM", language: "en", accent: "UK", gender: "Male" },
  { name: "Nova", style: "ENERGETIC", language: "en", accent: "US", gender: "Female" },
  { name: "Theo", style: "ENERGETIC", language: "en", accent: "US", gender: "Male" },
  { name: "Rowan", style: "DRAMATIC", language: "en", accent: "UK", gender: "Male" },
  { name: "Ivy", style: "DRAMATIC", language: "en", accent: "US", gender: "Female" },
  { name: "Ezra", style: "PROFESSIONAL", language: "en", accent: "US", gender: "Male" },
  { name: "Sage", style: "PROFESSIONAL", language: "en", accent: "UK", gender: "Female" },
  { name: "Juno", style: "EDUCATIONAL", language: "en", accent: "US", gender: "Female" },
  { name: "Felix", style: "EDUCATIONAL", language: "en", accent: "US", gender: "Male" },
  { name: "Wren", style: "FRIENDLY", language: "en", accent: "US", gender: "Female" },
  { name: "Arlo", style: "FRIENDLY", language: "en", accent: "UK", gender: "Male" },
  { name: "Talia", style: "STORYTELLING", language: "en", accent: "US", gender: "Female" },
  { name: "Dorian", style: "STORYTELLING", language: "en", accent: "UK", gender: "Male" },
];

const MUSIC_TRACKS: Array<{
  name: string;
  mood: "CINEMATIC" | "HAPPY" | "EMOTIONAL" | "INSPIRATIONAL" | "SUSPENSE" | "CALM" | "ADVENTURE" | "CORPORATE" | "CHILDRENS";
}> = [
  { name: "Golden Horizon", mood: "CINEMATIC" },
  { name: "Sunny Afternoon", mood: "HAPPY" },
  { name: "Quiet Goodbye", mood: "EMOTIONAL" },
  { name: "Rising Light", mood: "INSPIRATIONAL" },
  { name: "Held Breath", mood: "SUSPENSE" },
  { name: "Still Water", mood: "CALM" },
  { name: "Open Road", mood: "ADVENTURE" },
  { name: "Clear Focus", mood: "CORPORATE" },
  { name: "Bouncy Steps", mood: "CHILDRENS" },
];

async function main() {
  console.log("Seeding voice presets...");
  const voiceProvider = getVoiceProvider();
  const storage = getStorageProvider();

  for (const v of VOICES) {
    const existing = await prisma.voicePreset.findFirst({ where: { name: v.name, isSystem: true } });
    if (existing) continue;

    const asset = await voiceProvider.synthesize({
      text: `Hi, I'm ${v.name}. This is a preview of the ${v.style.toLowerCase()} voice.`,
      style: v.style,
      language: v.language,
      accent: v.accent,
      speed: 1,
      pitch: 1,
    });
    const { url } = await storage.put({
      category: "audio",
      filename: `voice-preview-${v.name.toLowerCase()}.wav`,
      data: asset.buffer,
      contentType: asset.contentType,
    });

    await prisma.voicePreset.create({
      data: {
        name: v.name,
        provider: voiceProvider.name,
        language: v.language,
        accent: v.accent,
        style: v.style,
        gender: v.gender,
        isSystem: true,
        previewUrl: url,
      },
    });
    console.log(`  + ${v.name} (${v.style})`);
  }

  console.log("Seeding music tracks...");
  const musicProvider = getMusicProvider();

  for (const t of MUSIC_TRACKS) {
    const existing = await prisma.musicTrack.findFirst({ where: { name: t.name, isSystem: true } });
    if (existing) continue;

    const asset = await musicProvider.generateTrack({ mood: t.mood, durationSeconds: 12 });
    const { url } = await storage.put({
      category: "audio",
      filename: `music-${t.name.toLowerCase().replaceAll(" ", "-")}.wav`,
      data: asset.buffer,
      contentType: asset.contentType,
    });

    await prisma.musicTrack.create({
      data: {
        name: t.name,
        mood: t.mood,
        provider: musicProvider.name,
        url,
        durationSeconds: Math.round(asset.durationSeconds),
        isSystem: true,
      },
    });
    console.log(`  + ${t.name} (${t.mood})`);
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
