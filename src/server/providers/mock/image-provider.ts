import type { ImageProvider, GeneratedAsset } from "../types";
import type { VisualStyle } from "@/generated/prisma/enums";

const STYLE_GRADIENTS: Record<VisualStyle, [string, string]> = {
  MODERN_CARTOON: ["#8c62f5", "#5c2dc4"],
  STORYBOOK: ["#ff9d5c", "#f0591d"],
  COMIC: ["#6f3fe0", "#ff7a3d"],
  THREE_D_ANIMATION: ["#ab8fff", "#4a239e"],
  MINIMAL_ILLUSTRATION: ["#ffcba4", "#ff7a3d"],
  HAND_DRAWN: ["#8c62f5", "#ff9d5c"],
  CINEMATIC_CARTOON: ["#391b78", "#8c62f5"],
  EDUCATIONAL: ["#6f3fe0", "#ff9d5c"],
  KIDS_ANIMATION: ["#ff9d5c", "#8c62f5"],
  DOCUMENTARY_ILLUSTRATION: ["#4a239e", "#f0591d"],
};

/**
 * Produces an SVG "scene card" as a stand-in for a real generated image.
 * This intentionally looks like a placeholder (gradient + label), not a
 * fake photorealistic render, so it never misrepresents itself as real AI
 * output. Swap for a real ImageProvider once an image-gen API key is set.
 */
export class MockImageProvider implements ImageProvider {
  readonly name = "mock";
  readonly isMock = true;

  async generateSceneImage(input: {
    prompt: string;
    style: VisualStyle;
    sceneNumber: number;
    sceneTitle: string;
    characterDescriptors: string[];
  }): Promise<GeneratedAsset> {
    const [from, to] = STYLE_GRADIENTS[input.style] ?? STYLE_GRADIENTS.MODERN_CARTOON;
    const svg = sceneSvg({
      from,
      to,
      sceneNumber: input.sceneNumber,
      title: input.sceneTitle,
      hasCharacters: input.characterDescriptors.length > 0,
    });

    return { buffer: Buffer.from(svg, "utf-8"), contentType: "image/svg+xml" };
  }

  async generateCharacterPortrait(input: { name: string; descriptor: string }): Promise<GeneratedAsset> {
    const svg = characterSvg({ name: input.name });
    return { buffer: Buffer.from(svg, "utf-8"), contentType: "image/svg+xml" };
  }
}

function sceneSvg(params: { from: string; to: string; sceneNumber: number; title: string; hasCharacters: boolean }) {
  const { from, to, sceneNumber, title } = params;
  const safeTitle = escapeXml(title);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1280" y2="720" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#g)"/>
  <text x="48" y="80" font-family="sans-serif" font-size="28" fill="white" opacity="0.85">Scene ${sceneNumber}</text>
  <text x="48" y="650" font-family="sans-serif" font-size="40" font-weight="700" fill="white">${safeTitle}</text>
  <text x="1232" y="672" font-family="sans-serif" font-size="18" fill="white" opacity="0.6" text-anchor="end">Mock preview — connect an image provider for real renders</text>
</svg>`;
}

function characterSvg(params: { name: string }) {
  const initial = escapeXml(params.name.charAt(0).toUpperCase() || "?");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#8c62f5"/>
      <stop offset="1" stop-color="#5c2dc4"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <circle cx="256" cy="256" r="120" fill="white" opacity="0.15"/>
  <text x="256" y="290" font-family="sans-serif" font-size="160" font-weight="700" fill="white" text-anchor="middle">${initial}</text>
  <text x="256" y="470" font-family="sans-serif" font-size="16" fill="white" opacity="0.6" text-anchor="middle">Mock portrait</text>
</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c] as string));
}
