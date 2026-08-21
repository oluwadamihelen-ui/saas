/**
 * The Prompt Engineer / prompt compiler (spec §22). Converts fully
 * resolved continuity data into a structured, provider-agnostic video
 * generation prompt — screenplay text is never sent to a video model
 * verbatim. Pure function: no I/O, fully unit-testable, and the exact
 * text callers can show via "View Generation Prompt" (spec §60).
 */

export interface CompiledCharacterContext {
  name: string;
  code: string;
  faceDescription?: string;
  continuityRules?: string;
  isLocked: boolean;
  wardrobeDescription?: string;
  wardrobeLocked?: boolean;
}

export interface CompiledPropContext {
  name: string;
  code: string;
  description?: string;
  continuityNotes?: string;
  isLocked: boolean;
}

export interface CompiledPromptContext {
  visualStyle: string;
  aspectRatio: "16:9" | "9:16" | "1:1";
  storyBible: {
    logline: string;
    tones: string[];
    world?: string;
  };
  scene: {
    intExt: "INT" | "EXT" | "INT_EXT";
    locationName: string;
    locationDescription?: string;
    timeOfDay?: string;
    locationLocked: boolean;
  };
  shot: {
    code: string;
    shotType: string;
    cameraMovement: string;
    lens?: string;
    framing?: string;
    eyeLine?: string;
    emotion?: string;
    action?: string;
    dialogue?: string;
    durationSeconds: number;
  };
  characters: CompiledCharacterContext[];
  props: CompiledPropContext[];
  previousShot?: {
    code: string;
    emotion?: string;
    action?: string;
  };
}

export interface CompiledPrompt {
  prompt: string;
  negativePrompt: string;
}

/**
 * Baseline negative constraints drawn directly from the "avoid" list in
 * spec §2. Applied to every shot regardless of continuity data, then
 * extended below with shot-specific continuity constraints.
 */
export const BASE_NEGATIVE_PROMPT_ITEMS: readonly string[] = [
  "cartoon or illustrated appearance",
  "generic/synthetic-looking AI face",
  "plastic or waxy skin texture",
  "distorted or malformed hands",
  "floating or physically impossible objects",
  "characters clipping through furniture or walls",
  "wardrobe changing mid-scene",
  "facial identity drifting between shots",
  "inconsistent hairstyle",
  "physically impossible camera movement",
  "unexplained background changes",
  "inconsistent time-of-day lighting",
  "props appearing or disappearing without narrative cause",
  "dialogue mismatched to the speaking character",
  "duplicated or cloned characters",
  "unexplained continuity breaks",
  "low-resolution or compressed artifacts",
  "watermarks or text overlays",
];

function section(title: string, body: string): string {
  return `${title}\n${body}`;
}

export function compileShotPrompt(ctx: CompiledPromptContext): CompiledPrompt {
  const subjectLines = ctx.characters.map((c) => {
    const lock = c.isLocked ? " [LOCKED IDENTITY — do not alter]" : "";
    const face = c.faceDescription ? ` — ${c.faceDescription}` : "";
    return `- ${c.name} (${c.code})${face}${lock}`;
  });

  const wardrobeLines = ctx.characters
    .filter((c) => c.wardrobeDescription)
    .map((c) => `- ${c.name}: ${c.wardrobeDescription}${c.wardrobeLocked ? " [LOCKED WARDROBE]" : ""}`);

  const propLines = ctx.props.map((p) => {
    const lock = p.isLocked ? " [LOCKED]" : "";
    return `- ${p.name} (${p.code})${p.description ? `: ${p.description}` : ""}${lock}`;
  });

  const environmentLines = [
    `${ctx.scene.intExt} — ${ctx.scene.locationName}${ctx.scene.timeOfDay ? `, ${ctx.scene.timeOfDay}` : ""}`,
    ctx.scene.locationDescription ?? "",
    ctx.scene.locationLocked ? "[LOCKED LOCATION — architecture, palette, and layout must match reference exactly]" : "",
  ].filter(Boolean);

  const continuityLines = [
    ctx.previousShot
      ? `Continuing directly from shot ${ctx.previousShot.code}${ctx.previousShot.emotion ? ` (emotional state: ${ctx.previousShot.emotion})` : ""}. Do not reset blocking, wardrobe, or lighting established there unless the action explicitly changes it.`
      : "This is the first shot of the scene — establish location, wardrobe, and lighting as described above.",
    ...ctx.characters.filter((c) => c.continuityRules).map((c) => `${c.name}: ${c.continuityRules}`),
    ...ctx.props.filter((p) => p.continuityNotes).map((p) => `${p.name}: ${p.continuityNotes}`),
  ].filter(Boolean);

  const prompt = [
    section("CINEMATOGRAPHY", `${ctx.visualStyle}, photorealistic, professional film grammar, ${ctx.storyBible.tones.join(", ")} tone.`),
    section("SUBJECT", subjectLines.join("\n") || "No principal characters in this shot."),
    section("ENVIRONMENT", environmentLines.join("\n")),
    section("ACTION", ctx.shot.action ?? "Static composition, no significant character movement."),
    section(
      "PERFORMANCE",
      `Emotional state: ${ctx.shot.emotion ?? "neutral"}. Natural, believable body language and facial performance consistent with that emotional state.`,
    ),
    section(
      "CAMERA",
      `${ctx.shot.shotType.replace(/_/g, " ").toLowerCase()} shot, ${ctx.shot.cameraMovement.replace(/_/g, " ").toLowerCase()} movement${ctx.shot.framing ? `, framing: ${ctx.shot.framing}` : ""}${ctx.shot.eyeLine ? `, eye-line: ${ctx.shot.eyeLine}` : ""}.`,
    ),
    section("LIGHTING", ctx.scene.timeOfDay ? `Lighting consistent with ${ctx.scene.timeOfDay.toLowerCase()} at this location.` : "Lighting consistent with the established scene."),
    section("LENS", ctx.shot.lens ?? "Standard cinematic lens appropriate to the shot type."),
    section("COMPOSITION", `${ctx.aspectRatio} aspect ratio, cinematic framing and rule-of-thirds composition.`),
    section("WARDROBE", wardrobeLines.join("\n") || "As established for this scene."),
    section("PROPS", propLines.join("\n") || "No significant props in this shot."),
    section("CONTINUITY", continuityLines.join("\n")),
    section("AUDIO", "Natural ambient sound consistent with the environment; no music (scored separately)."),
    section("DIALOGUE", ctx.shot.dialogue ? `"${ctx.shot.dialogue}"` : "No dialogue in this shot."),
    section("DURATION", `${ctx.shot.durationSeconds} seconds.`),
  ].join("\n\n");

  const continuityNegatives = ctx.characters.filter((c) => c.isLocked).map((c) => `${c.name} changing facial identity from the locked reference`);

  const negativePrompt = [...BASE_NEGATIVE_PROMPT_ITEMS, ...continuityNegatives].join(", ");

  return { prompt, negativePrompt };
}
