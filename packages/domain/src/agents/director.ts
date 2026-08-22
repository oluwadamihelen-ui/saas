import type { ModelRouter } from "@cinerra/ai";
import { extractJson } from "../lib/json.js";

/**
 * Director agent (spec §18-19, §62). Breaks a single scene into cinematic
 * coverage — the Shot Engine. Chooses shot type and camera movement
 * automatically per standard film grammar; the user can override any shot
 * afterward (spec §19).
 */

const SHOT_TYPES = [
  "EXTREME_WIDE",
  "WIDE",
  "MEDIUM_WIDE",
  "MEDIUM",
  "MEDIUM_CLOSE_UP",
  "CLOSE_UP",
  "EXTREME_CLOSE_UP",
  "OVER_THE_SHOULDER",
  "TWO_SHOT",
  "POV",
  "INSERT",
] as const;

const CAMERA_MOVEMENTS = ["LOCKED_OFF", "TRACKING", "DOLLY", "CRANE", "HANDHELD", "PUSH_IN", "PULL_OUT", "PAN", "TILT", "RACK_FOCUS"] as const;

export interface DirectorInput {
  visualStyle: string;
  intExt: "INT" | "EXT" | "INT_EXT";
  locationName: string;
  timeOfDay?: string;
  storyPurpose?: string;
  emotionalState?: string;
  characterNames: string[];
  /** Props already known to exist in this project — the Director may only reference these, never invent new ones. */
  propNames: string[];
  scriptText: string;
}

export interface DirectorShot {
  order: number;
  shotType: (typeof SHOT_TYPES)[number];
  cameraMovement: (typeof CAMERA_MOVEMENTS)[number];
  lens?: string;
  framing?: string;
  eyeLine?: string;
  emotion?: string;
  action: string;
  dialogue?: string;
  durationSeconds: number;
  characterNames: string[];
  propNames: string[];
}

export interface DirectorOutput {
  shots: DirectorShot[];
}

const SYSTEM_PROMPT = `You are the Director agent for Cinerra. You break one screenplay scene into professional cinematic coverage: typically an establishing shot, then a mix of mediums/close-ups/over-the-shoulders/inserts driven by the dialogue and action, following standard film grammar (spec: cut on action/dialogue beats, cover both sides of a conversation, use inserts for significant props, use a reaction shot after an emotional beat). 3-8 shots per scene depending on length. durationSeconds should be realistic for the action/dialogue in that shot (3-10 seconds typical). Emotional state must progress naturally shot-to-shot — never jump discontinuously unless the scene text causes it. propNames on each shot may only contain names from the provided prop list — never invent a prop, and leave it empty for shots with no significant prop in frame.

Valid shotType values: ${SHOT_TYPES.join(", ")}
Valid cameraMovement values: ${CAMERA_MOVEMENTS.join(", ")}

Respond with ONLY a single JSON object, no prose, no markdown fence:
{
  "shots": [{
    "order": number,
    "shotType": string,
    "cameraMovement": string,
    "lens": string,
    "framing": string,
    "eyeLine": string,
    "emotion": string,
    "action": string,
    "dialogue": string,
    "durationSeconds": number,
    "characterNames": string[],
    "propNames": string[]
  }]
}`;

function buildUserPrompt(input: DirectorInput): string {
  return [
    `Visual style: ${input.visualStyle}`,
    `${input.intExt}. ${input.locationName}${input.timeOfDay ? ` — ${input.timeOfDay}` : ""}`,
    input.storyPurpose ? `Story purpose: ${input.storyPurpose}` : undefined,
    input.emotionalState ? `Scene emotional state: ${input.emotionalState}` : undefined,
    `Characters present: ${input.characterNames.join(", ") || "none"}`,
    `Props known to exist in this project (only reference ones actually visible/used in this scene — never invent a new prop and never force an irrelevant one into a shot): ${input.propNames.join(", ") || "none"}`,
    `\nSCENE TEXT:\n${input.scriptText}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runDirector(router: ModelRouter, input: DirectorInput): Promise<DirectorOutput> {
  const result = await router.execute("TEXT", "BEST_QUALITY", (provider) =>
    provider.generateText({ system: SYSTEM_PROMPT, prompt: buildUserPrompt(input), maxTokens: 3072, temperature: 0.75 }),
  );

  const parsed = extractJson<DirectorOutput>(result.text);
  if (!Array.isArray(parsed.shots) || parsed.shots.length === 0) {
    throw new Error("Director response did not include any shots.");
  }
  for (const shot of parsed.shots) {
    if (!SHOT_TYPES.includes(shot.shotType)) shot.shotType = "MEDIUM";
    if (!CAMERA_MOVEMENTS.includes(shot.cameraMovement)) shot.cameraMovement = "LOCKED_OFF";
  }
  return parsed;
}
