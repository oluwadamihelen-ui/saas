import type { ModelRouter } from "@cinerra/ai";
import { extractJson } from "../lib/json.js";

/**
 * Prop Designer agent (spec §16, §62). Reads the screenplay and proposes a
 * Prop Bible entry for every significant, plot-relevant, or visually
 * recurring prop that actually appears in it — never invents props the
 * screenplay doesn't mention, and skips incidental background objects the
 * story never calls attention to.
 */

export interface PropDesignerInput {
  visualStyle: string;
  characterNames: string[];
  screenplayExcerpt: string;
}

export interface PropDesignerProp {
  name: string;
  description: string;
  continuityNotes: string;
  /** Exact name from characterNames if this prop clearly belongs to one character; omitted for scene set-dressing. */
  ownerCharacterName?: string;
}

export interface PropDesignerOutput {
  props: PropDesignerProp[];
}

const SYSTEM_PROMPT = `You are the Prop Designer agent for FilmDoe. You read a screenplay and produce a Prop Bible entry for every significant, plot-relevant, or visually recurring prop explicitly present in the action lines — never invent props the screenplay doesn't mention. Skip incidental background objects (a chair, a lamp) unless the story specifically calls attention to them. If a prop clearly belongs to one character, set ownerCharacterName to that character's name exactly as given in the character list; otherwise omit ownerCharacterName entirely. Descriptions must be specific enough to keep an AI video model visually consistent across shots: exact material, color, shape, and wear/condition — not generic adjectives.

Respond with ONLY a single JSON object, no prose, no markdown fence:
{
  "props": [{
    "name": string,
    "description": string,
    "continuityNotes": string,
    "ownerCharacterName": string
  }]
}`;

function buildUserPrompt(input: PropDesignerInput): string {
  return [
    `Visual style: ${input.visualStyle}`,
    `Characters: ${input.characterNames.join(", ") || "none"}`,
    `\nSCREENPLAY:\n${input.screenplayExcerpt}`,
  ].join("\n");
}

export async function runPropDesigner(router: ModelRouter, input: PropDesignerInput): Promise<PropDesignerOutput> {
  const result = await router.execute("TEXT", "BEST_QUALITY", (provider) =>
    provider.generateText({ system: SYSTEM_PROMPT, prompt: buildUserPrompt(input), maxTokens: 3072, temperature: 0.6 }),
  );

  const parsed = extractJson<PropDesignerOutput>(result.text);
  if (!Array.isArray(parsed.props)) {
    throw new Error("Prop Designer response did not include a props array.");
  }
  return parsed;
}
