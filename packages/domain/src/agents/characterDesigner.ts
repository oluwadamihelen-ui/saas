import type { ModelRouter } from "@cinerra/ai";
import { extractJson } from "../lib/json.js";

/**
 * Character Designer agent (spec §13, §62). Reads the Story Bible plus the
 * screenplay written so far and proposes the Character Bible — physical
 * description, personality, voice, arc, and a default wardrobe entry per
 * character. It only ever proposes characters that already appear in the
 * screenplay; it does not invent new principal characters unprompted.
 */

export interface CharacterDesignerInput {
  logline: string;
  premise: string;
  world: string;
  storyRules: string[];
  visualStyle: string;
  screenplayExcerpt: string;
}

export interface CharacterDesignerWardrobe {
  name: string;
  clothing: string;
  colors: string;
  shoes?: string;
  accessories?: string;
  hairstyle?: string;
  makeup?: string;
}

export interface CharacterDesignerCharacter {
  name: string;
  age?: number;
  gender?: string;
  face: string;
  hair: string;
  eyes: string;
  skin?: string;
  height?: string;
  build?: string;
  personality: string;
  voiceProfile: string;
  accent?: string;
  characterArc: string;
  continuityRules: string;
  defaultWardrobe: CharacterDesignerWardrobe;
}

export interface CharacterDesignerOutput {
  characters: CharacterDesignerCharacter[];
}

const SYSTEM_PROMPT = `You are the Character Designer agent for Cinerra. You read a screenplay and produce a Character Bible entry for every named character who actually appears in it — never invent characters the screenplay doesn't already have. Descriptions must be specific and reproducible enough to keep a photorealistic AI video model visually consistent across shots (exact hair, eyes, skin, build — not generic adjectives). continuityRules must state the hard identity constraint downstream generation must never violate.

Respond with ONLY a single JSON object, no prose, no markdown fence:
{
  "characters": [{
    "name": string,
    "age": number,
    "gender": string,
    "face": string,
    "hair": string,
    "eyes": string,
    "skin": string,
    "height": string,
    "build": string,
    "personality": string,
    "voiceProfile": string,
    "accent": string,
    "characterArc": string,
    "continuityRules": string,
    "defaultWardrobe": { "name": string, "clothing": string, "colors": string, "shoes": string, "accessories": string, "hairstyle": string, "makeup": string }
  }]
}`;

function buildUserPrompt(input: CharacterDesignerInput): string {
  return [
    `Logline: ${input.logline}`,
    `Premise: ${input.premise}`,
    `World: ${input.world}`,
    `Story rules: ${input.storyRules.join("; ") || "none"}`,
    `Visual style: ${input.visualStyle}`,
    `\nSCREENPLAY:\n${input.screenplayExcerpt}`,
  ].join("\n");
}

export async function runCharacterDesigner(router: ModelRouter, input: CharacterDesignerInput): Promise<CharacterDesignerOutput> {
  const result = await router.execute("TEXT", "BEST_QUALITY", (provider) =>
    provider.generateText({ system: SYSTEM_PROMPT, prompt: buildUserPrompt(input), maxTokens: 4096, temperature: 0.7 }),
  );

  const parsed = extractJson<CharacterDesignerOutput>(result.text);
  if (!Array.isArray(parsed.characters) || parsed.characters.length === 0) {
    throw new Error("Character Designer response did not include any characters.");
  }
  return parsed;
}
