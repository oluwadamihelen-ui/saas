/// Pure color math for deriving a full accent palette from one brand hex
/// — no dependency, since this is the only place in the app that needs it.
/// Mirrors the three tokens globals.css already defines for --accent:
/// the accent itself, a soft/tint background, and a foreground that stays
/// legible on it.

type Rgb = [number, number, number];

export function isValidHexColor(value: string): boolean {
  const v = value.trim();
  return /^#?[0-9a-fA-F]{6}$/.test(v) || /^#?[0-9a-fA-F]{3}$/.test(v);
}

function normalizeHex(hex: string): string {
  let h = hex.trim();
  if (!h.startsWith("#")) h = `#${h}`;
  if (h.length === 4) {
    h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }
  return h.toLowerCase();
}

function hexToRgb(hex: string): Rgb {
  const h = normalizeHex(hex).slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex([r, g, b]: Rgb): string {
  const clamp = (v: number) => Math.round(Math.max(0, Math.min(255, v)));
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;
}

function mixWithWhite(rgb: Rgb, t: number): Rgb {
  return [rgb[0] + (255 - rgb[0]) * t, rgb[1] + (255 - rgb[1]) * t, rgb[2] + (255 - rgb[2]) * t];
}

/// WCAG relative luminance — used to pick a black or white foreground that
/// stays readable on the accent color, whatever a school happens to choose.
function relativeLuminance([r, g, b]: Rgb): number {
  const srgb = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

export interface BrandTokens {
  accent: string;
  accentSoft: string;
  accentForeground: string;
}

export function buildBrandTokens(hex: string): BrandTokens {
  const accent = normalizeHex(hex);
  const rgb = hexToRgb(accent);
  return {
    accent,
    accentSoft: rgbToHex(mixWithWhite(rgb, 0.88)),
    accentForeground: relativeLuminance(rgb) > 0.5 ? "#131a2b" : "#ffffff",
  };
}
