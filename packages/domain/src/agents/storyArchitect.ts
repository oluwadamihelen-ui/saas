import type { ModelRouter } from "@cinerra/ai";
import { extractJson } from "../lib/json.js";

/**
 * Story Architect agent (spec §62). Turns a raw idea (Inspiration Mode) or
 * a condensed source summary (Adaptation Mode) into the project's
 * canonical Story Bible. This is the top of the source-of-truth hierarchy
 * (spec §63) — every downstream agent (Screenwriter, Character/Location
 * Designer, Director) is constrained by what this agent produces, and
 * nothing downstream is allowed to rewrite it automatically.
 */

export interface StoryArchitectInput {
  storyIdea: string;
  genres: string[];
  tones: string[];
  setting?: string;
  targetAudience?: string;
  format: "SHORT_FILM" | "FEATURE_FILM" | "MINI_SERIES" | "SERIES";
  episodeCount: number;
  /** Present only in Adaptation Mode — the source material is authoritative over invention. */
  sourceMaterialSummary?: string;
}

export interface StoryArchitectEpisodeBeat {
  number: number;
  title: string;
  synopsis: string;
}

export interface StoryArchitectOutput {
  logline: string;
  premise: string;
  theme: string;
  world: string;
  storyRules: string[];
  episodeStructure: StoryArchitectEpisodeBeat[];
}

const SYSTEM_PROMPT = `You are the Story Architect for FilmDoe, a professional AI filmmaking platform. You develop the canonical Story Bible for a cinematic production. You write like a working television/film story editor: specific, visual, emotionally grounded — never generic or vague.

Rules you must always follow:
- If source material is provided, it is the authoritative source of truth. Never invent characters, relationships, or events that contradict it.
- storyRules are hard continuity constraints downstream agents must never violate (e.g. "Nate is deceased and only appears in flashback").
- episodeStructure must contain exactly the requested number of episodes, each with a distinct dramatic function (setup, escalation, midpoint turn, crisis, resolution as appropriate).
- Respond with ONLY a single JSON object — no prose, no markdown fence — matching this exact shape:
{
  "logline": string,
  "premise": string,
  "theme": string,
  "world": string,
  "storyRules": string[],
  "episodeStructure": [{ "number": number, "title": string, "synopsis": string }]
}`;

function buildUserPrompt(input: StoryArchitectInput): string {
  const lines = [
    `Format: ${input.format}`,
    `Episode count: ${input.episodeCount}`,
    `Genres: ${input.genres.join(", ") || "unspecified"}`,
    `Tones: ${input.tones.join(", ") || "unspecified"}`,
    input.setting ? `Setting: ${input.setting}` : undefined,
    input.targetAudience ? `Target audience: ${input.targetAudience}` : undefined,
    input.sourceMaterialSummary
      ? `\nSOURCE MATERIAL (authoritative — do not contradict):\n${input.sourceMaterialSummary}`
      : `\nSTORY IDEA:\n${input.storyIdea}`,
  ].filter(Boolean);
  return lines.join("\n");
}

export async function runStoryArchitect(router: ModelRouter, input: StoryArchitectInput): Promise<StoryArchitectOutput> {
  const result = await router.execute("TEXT", "BEST_QUALITY", (provider) =>
    provider.generateText({
      system: SYSTEM_PROMPT,
      prompt: buildUserPrompt(input),
      maxTokens: 4096,
      temperature: 0.9,
    }),
  );

  const parsed = extractJson<StoryArchitectOutput>(result.text);
  validateOutput(parsed, input.episodeCount);
  return parsed;
}

function validateOutput(output: StoryArchitectOutput, expectedEpisodeCount: number): void {
  if (!output.logline || !output.premise) {
    throw new Error("Story Architect response was missing required fields (logline/premise).");
  }
  if (!Array.isArray(output.episodeStructure) || output.episodeStructure.length === 0) {
    throw new Error("Story Architect response did not include an episode structure.");
  }
  if (output.episodeStructure.length !== expectedEpisodeCount) {
    // Non-fatal in principle, but we surface it loudly rather than silently
    // truncating/padding — downstream episode creation must match 1:1.
    throw new Error(
      `Story Architect returned ${output.episodeStructure.length} episodes but ${expectedEpisodeCount} were requested.`,
    );
  }
}
