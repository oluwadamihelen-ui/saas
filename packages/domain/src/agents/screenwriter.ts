import type { ModelRouter } from "@cinerra/ai";
import { extractJson } from "../lib/json.js";

/**
 * Screenwriter agent (spec §62). Expands one episode's beat summary (from
 * the Story Bible, produced by the Story Architect) into a scene-by-scene
 * screenplay. Constrained by the Story Bible's storyRules — it may not
 * introduce characters, locations, or events the bible doesn't already
 * imply; the Scene Engine downstream turns its output into persisted
 * Scene rows.
 */

export interface ScreenwriterInput {
  logline: string;
  premise: string;
  world: string;
  storyRules: string[];
  episodeNumber: number;
  episodeTitle: string;
  episodeSynopsis: string;
  visualStyle: string;
}

export interface ScreenwriterScene {
  number: number;
  intExt: "INT" | "EXT" | "INT_EXT";
  locationName: string;
  timeOfDay: string;
  characterNames: string[];
  storyPurpose: string;
  emotionalState: string;
  scriptText: string;
}

export interface ScreenwriterOutput {
  scenes: ScreenwriterScene[];
}

const SYSTEM_PROMPT = `You are the Screenwriter agent for Cinerra. You write tight, visual, production-ready screenplay scenes in standard format (INT./EXT. LOCATION - TIME, action lines, character names in caps before dialogue). You never contradict the story bible's storyRules. You break an episode into 4-8 scenes with clear dramatic purpose each.

Respond with ONLY a single JSON object, no prose, no markdown fence:
{
  "scenes": [{
    "number": number,
    "intExt": "INT" | "EXT" | "INT_EXT",
    "locationName": string,
    "timeOfDay": string,
    "characterNames": string[],
    "storyPurpose": string,
    "emotionalState": string,
    "scriptText": string
  }]
}`;

function buildUserPrompt(input: ScreenwriterInput): string {
  return [
    `Logline: ${input.logline}`,
    `Premise: ${input.premise}`,
    `World: ${input.world}`,
    `Story rules (must not be violated): ${input.storyRules.join("; ") || "none"}`,
    `Visual style: ${input.visualStyle}`,
    `\nEpisode ${input.episodeNumber}: ${input.episodeTitle}`,
    `Episode synopsis: ${input.episodeSynopsis}`,
  ].join("\n");
}

export async function runScreenwriter(router: ModelRouter, input: ScreenwriterInput): Promise<ScreenwriterOutput> {
  const result = await router.execute("TEXT", "BEST_QUALITY", (provider) =>
    provider.generateText({ system: SYSTEM_PROMPT, prompt: buildUserPrompt(input), maxTokens: 8192, temperature: 0.85 }),
  );

  const parsed = extractJson<ScreenwriterOutput>(result.text);
  if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
    throw new Error("Screenwriter response did not include any scenes.");
  }
  return parsed;
}
