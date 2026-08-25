import type { ModelRouter } from "@cinerra/ai";
import { extractJson } from "../lib/json.js";

/**
 * Location Designer agent (spec §14, §62). Reads the screenplay and
 * proposes a Location Bible entry for every distinct location that
 * actually appears — never invents a location the screenplay doesn't use.
 */

export interface LocationDesignerInput {
  world: string;
  visualStyle: string;
  screenplayExcerpt: string;
}

export interface LocationDesignerLocation {
  name: string;
  architecture: string;
  lighting: string;
  colorPalette: string;
  furniture?: string;
  layout?: string;
  continuityRules: string;
}

export interface LocationDesignerOutput {
  locations: LocationDesignerLocation[];
}

const SYSTEM_PROMPT = `You are the Location Designer agent for FilmDoe. You read a screenplay and produce a Location Bible entry for every distinct INT./EXT. location that actually appears in it — never invent locations the screenplay doesn't use. Merge scene headings that describe the same physical place (e.g. "COLE HOUSE - KITCHEN" appearing in two scenes is one location, not two). Descriptions must be specific enough to keep an AI video model visually consistent across shots: exact architecture, lighting character, and color palette — not generic adjectives.

Respond with ONLY a single JSON object, no prose, no markdown fence:
{
  "locations": [{
    "name": string,
    "architecture": string,
    "lighting": string,
    "colorPalette": string,
    "furniture": string,
    "layout": string,
    "continuityRules": string
  }]
}`;

function buildUserPrompt(input: LocationDesignerInput): string {
  return [`World: ${input.world}`, `Visual style: ${input.visualStyle}`, `\nSCREENPLAY:\n${input.screenplayExcerpt}`].join("\n");
}

export async function runLocationDesigner(router: ModelRouter, input: LocationDesignerInput): Promise<LocationDesignerOutput> {
  const result = await router.execute("TEXT", "BEST_QUALITY", (provider) =>
    provider.generateText({ system: SYSTEM_PROMPT, prompt: buildUserPrompt(input), maxTokens: 3072, temperature: 0.7 }),
  );

  const parsed = extractJson<LocationDesignerOutput>(result.text);
  if (!Array.isArray(parsed.locations) || parsed.locations.length === 0) {
    throw new Error("Location Designer response did not include any locations.");
  }
  return parsed;
}
