import { describe, it, expect } from "vitest";
import { MockImageProvider } from "./image-provider";

describe("MockImageProvider", () => {
  const provider = new MockImageProvider();

  it("is clearly marked as mock", () => {
    expect(provider.isMock).toBe(true);
    expect(provider.name).toBe("mock");
  });

  it("generates a well-formed, non-empty SVG for a scene image", async () => {
    const asset = await provider.generateSceneImage({
      prompt: "a hero standing on a hill",
      style: "MODERN_CARTOON",
      sceneNumber: 1,
      sceneTitle: "Opening",
      characterDescriptors: [],
    });

    expect(asset.contentType).toBe("image/svg+xml");
    const svg = asset.buffer.toString("utf-8");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("</svg>");
    expect(svg).toContain("Mock preview");
  });

  it("escapes XML-unsafe characters in the scene title", async () => {
    const asset = await provider.generateSceneImage({
      prompt: "x",
      style: "MODERN_CARTOON",
      sceneNumber: 1,
      sceneTitle: `<script>alert("hi")</script> & 'friends'`,
      characterDescriptors: [],
    });
    const svg = asset.buffer.toString("utf-8");
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });

  it("falls back to the default gradient for an unknown style", async () => {
    const asset = await provider.generateSceneImage({
      prompt: "x",
      style: "NOT_A_REAL_STYLE" as never,
      sceneNumber: 1,
      sceneTitle: "Fallback",
      characterDescriptors: [],
    });
    expect(asset.buffer.toString("utf-8")).toContain("#8c62f5");
  });

  it("generates a character portrait keyed off the first letter of the name", async () => {
    const asset = await provider.generateCharacterPortrait({ name: "zara", descriptor: "brave explorer" });
    const svg = asset.buffer.toString("utf-8");
    expect(svg).toContain(">Z<");
  });
});
