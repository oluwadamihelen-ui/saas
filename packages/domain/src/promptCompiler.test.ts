import { describe, expect, it } from "vitest";
import { compileShotPrompt, type CompiledPromptContext } from "./promptCompiler.js";

const baseContext: CompiledPromptContext = {
  visualStyle: "Cinematic Drama",
  aspectRatio: "9:16",
  storyBible: { logline: "A woman uncovers her husband's double life.", tones: ["Suspenseful", "Emotional"] },
  scene: { intExt: "INT", locationName: "Cole House Kitchen", locationDescription: "Marble island, brass fixtures", timeOfDay: "EVENING", locationLocked: true },
  shot: {
    code: "SC03-SH001",
    shotType: "WIDE",
    cameraMovement: "LOCKED_OFF",
    action: "Maren chops vegetables; Nate enters.",
    emotion: "warm domestic calm",
    durationSeconds: 6,
  },
  characters: [
    { name: "Maren Cole", code: "CHAR-MAR-01", isLocked: true, continuityRules: "Must retain facial identity across all scenes.", wardrobeDescription: "cream sweater", wardrobeLocked: true },
  ],
  props: [{ name: "Maren's smartphone", code: "PROP-PHONE-MAR-01", isLocked: true, continuityNotes: "Crack must remain visible." }],
};

describe("compileShotPrompt", () => {
  it("includes every compiler section", () => {
    const { prompt } = compileShotPrompt(baseContext);
    for (const section of [
      "CINEMATOGRAPHY",
      "SUBJECT",
      "ENVIRONMENT",
      "ACTION",
      "PERFORMANCE",
      "CAMERA",
      "LIGHTING",
      "LENS",
      "COMPOSITION",
      "CONTINUITY",
      "AUDIO",
      "DIALOGUE",
    ]) {
      expect(prompt).toContain(section);
    }
  });

  it("marks locked characters as non-negotiable identity constraints", () => {
    const { prompt } = compileShotPrompt(baseContext);
    expect(prompt).toContain("LOCKED IDENTITY");
    expect(prompt).toContain("Maren Cole");
  });

  it("always includes the baseline quality/continuity negative prompt", () => {
    const { negativePrompt } = compileShotPrompt(baseContext);
    expect(negativePrompt).toContain("distorted or malformed hands");
    expect(negativePrompt).toContain("facial identity drifting");
  });

  it("adds a per-character negative constraint for locked characters", () => {
    const { negativePrompt } = compileShotPrompt(baseContext);
    expect(negativePrompt).toContain("Maren Cole changing facial identity from the locked reference");
  });

  it("references the previous shot for continuity when present", () => {
    const { prompt } = compileShotPrompt({
      ...baseContext,
      previousShot: { code: "SC03-SH000", emotion: "warm domestic calm" },
    });
    expect(prompt).toContain("Continuing directly from shot SC03-SH000");
  });

  it("treats the first shot of a scene as establishing, not continuing", () => {
    const { prompt } = compileShotPrompt(baseContext);
    expect(prompt).toContain("first shot of the scene");
  });
});
