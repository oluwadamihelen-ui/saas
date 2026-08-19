import type { AIProvider, ScriptAnalysis, StoryboardResult, StoryboardCharacter, StoryboardScene } from "../types";
import type { VisualStyle } from "@/generated/prisma/enums";

const CAMERAS = ["slow push in", "static wide shot", "pan left to right", "close-up", "tracking shot", "slow pull back"];
const TRANSITIONS = ["fade", "cut", "dissolve", "wipe"];
const LOCATIONS = ["an open outdoor setting", "an indoor scene", "a bright, colorful backdrop", "a quiet, focused space", "a bustling environment"];

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
  "is", "was", "were", "are", "be", "been", "it", "its", "this", "that", "as", "by",
  "he", "she", "they", "we", "you", "i", "his", "her", "their", "our", "your", "my",
]);

/**
 * Deterministic, rule-based storyboard generator. This is NOT a real language
 * model — it uses text-splitting and word-frequency heuristics to produce a
 * structurally valid storyboard so the rest of the pipeline (scenes,
 * characters, image generation, editor) can be built and tested end-to-end
 * without an external AI API key. Every provider here sets isMock=true and
 * the UI surfaces that clearly.
 */
export class MockAIProvider implements AIProvider {
  readonly name = "mock";
  readonly isMock = true;

  async analyzeScript(input: { idea?: string; script?: string; language: string }): Promise<ScriptAnalysis> {
    const text = (input.script || input.idea || "").trim();
    const wordCount = text ? text.split(/\s+/).length : 0;
    const sentenceCount = splitSentences(text).length;

    return {
      summary: text
        ? `A ${sentenceCount}-beat story (${wordCount} words) suitable for a short animated video.`
        : "No script or idea provided yet.",
      tone: guessTone(text),
      pacing: sentenceCount > 8 ? "fast, many short beats" : sentenceCount > 3 ? "moderate" : "slow, few beats",
      suggestedSceneCount: clamp(sentenceCount || 3, 3, 8),
    };
  }

  async generateStoryboard(input: {
    idea?: string;
    script?: string;
    style: VisualStyle;
    language: string;
    targetLengthSeconds?: number;
  }): Promise<StoryboardResult> {
    const text = (input.script || input.idea || "").trim();
    const sentences = splitSentences(text);
    const beats = sentences.length > 0 ? sentences : [text || "An untitled story begins."];

    const sceneCount = clamp(beats.length, 3, 8);
    const groups = groupIntoScenes(beats, sceneCount);
    const totalLength = input.targetLengthSeconds ?? sceneCount * 6;
    const perScene = Math.max(3, Math.round(totalLength / groups.length));

    const characters = extractCharacters(text);

    const scenes: StoryboardScene[] = groups.map((beat, i) => {
      const mentionedCharacters = characters.filter((c) =>
        beat.toLowerCase().includes(c.name.toLowerCase())
      );

      return {
        title: titleFromBeat(beat, i),
        narration: beat,
        visualPrompt: `${input.style.toLowerCase().replaceAll("_", " ")} style illustration: ${beat}`,
        location: LOCATIONS[i % LOCATIONS.length],
        camera: CAMERAS[i % CAMERAS.length],
        transition: TRANSITIONS[i % TRANSITIONS.length],
        durationSeconds: perScene,
        characterNames: mentionedCharacters.map((c) => c.name),
      };
    });

    return { scenes, characters };
  }
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function groupIntoScenes(beats: string[], sceneCount: number): string[] {
  if (beats.length <= sceneCount) return beats;

  const groups: string[] = [];
  const perGroup = Math.ceil(beats.length / sceneCount);
  for (let i = 0; i < beats.length; i += perGroup) {
    groups.push(beats.slice(i, i + perGroup).join(" "));
  }
  return groups;
}

function titleFromBeat(beat: string, index: number): string {
  const words = beat.replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean);
  const meaningful = words.filter((w) => !STOPWORDS.has(w.toLowerCase())).slice(0, 4);
  const base = (meaningful.length ? meaningful : words.slice(0, 4)).join(" ");
  return base ? capitalize(base) : `Scene ${index + 1}`;
}

function extractCharacters(text: string): StoryboardCharacter[] {
  if (!text) return [];

  const found = new Map<string, string>();

  // Capitalized proper nouns not at a sentence start (e.g. "Maya", "Jonas").
  const words = text.split(/\s+/);
  for (let i = 1; i < words.length; i++) {
    const w = words[i].replace(/[^\w']/g, "");
    if (w.length > 1 && /^[A-Z][a-z]+$/.test(w) && !STOPWORDS.has(w.toLowerCase())) {
      found.set(w, `A character named ${w}, appearance to be defined.`);
    }
  }

  // "a/an <adjective> <noun>" style descriptions (e.g. "a curious fox").
  const descMatches = text.matchAll(/\b(?:a|an)\s+([a-z]+\s+)?([a-z]+)\b/gi);
  for (const m of descMatches) {
    const noun = m[2]?.toLowerCase();
    if (noun && ANIMAL_OR_ROLE_NOUNS.has(noun) && !found.has(noun)) {
      const label = capitalize(`${m[1] ? m[1].trim() + " " : ""}${noun}`);
      found.set(label, `The ${label.toLowerCase()} from the story.`);
    }
  }

  return Array.from(found.entries())
    .slice(0, 4)
    .map(([name, appearance]) => ({
      name,
      appearance,
      personality: "Defined by their role in the story — refine this in the Characters library.",
    }));
}

const ANIMAL_OR_ROLE_NOUNS = new Set([
  "fox", "dog", "cat", "bird", "bear", "rabbit", "wolf", "owl", "mouse", "dragon",
  "boy", "girl", "man", "woman", "teacher", "student", "robot", "wizard", "knight",
  "child", "hero", "princess", "prince", "explorer", "scientist", "astronaut",
]);

function guessTone(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(sad|loss|cry|alone|grief)\b/.test(lower)) return "emotional";
  if (/\b(learn|understand|because|therefore|explain)\b/.test(lower)) return "educational";
  if (/\b(danger|chase|escape|fight|race)\b/.test(lower)) return "adventurous";
  if (/\b(laugh|funny|silly|joke)\b/.test(lower)) return "lighthearted";
  return "neutral, narrative";
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function capitalize(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
