import { describe, expect, it } from "vitest";
import { buildMusicPrompt } from "./musicPrompt.js";

describe("buildMusicPrompt", () => {
  it("includes genre, tone, title, and synopsis when a story bible exists", () => {
    const prompt = buildMusicPrompt(
      { title: "The Long Night", synopsis: "A detective chases a killer through the city." },
      { genres: ["Thriller", "Noir"], tones: ["Dark", "Suspenseful"] },
    );
    expect(prompt).toContain("Thriller, Noir");
    expect(prompt).toContain("Dark, Suspenseful");
    expect(prompt).toContain("The Long Night");
    expect(prompt).toContain("A detective chases a killer through the city.");
    expect(prompt).toContain("No vocals, no lyrics");
  });

  it("falls back to generic genre/tone when there is no story bible", () => {
    const prompt = buildMusicPrompt({ title: "Pilot", synopsis: null }, null);
    expect(prompt).toContain("cinematic drama");
    expect(prompt).toContain("atmospheric");
    expect(prompt).not.toContain("null");
  });

  it("omits the synopsis sentence when the episode has none", () => {
    const prompt = buildMusicPrompt({ title: "Pilot", synopsis: null }, { genres: ["Drama"], tones: ["Hopeful"] });
    expect(prompt).not.toContain("The episode is about");
  });

  it("falls back to generic genre/tone when the story bible has empty arrays", () => {
    const prompt = buildMusicPrompt({ title: "Pilot", synopsis: null }, { genres: [], tones: [] });
    expect(prompt).toContain("cinematic drama");
    expect(prompt).toContain("atmospheric");
  });
});
