import type { Config } from "tailwindcss";

/**
 * Resolves a Tailwind color to the "r g b" CSS custom property of the same
 * brand token (see globals.css :root), while still supporting Tailwind's
 * opacity modifiers (bg-cinerra-accent/40) — Tailwind needs a raw RGB
 * triplet to combine with an alpha value, so this is the documented
 * pattern for CSS-variable-backed colors: https://tailwindcss.com/docs/customizing-colors#using-css-variables
 */
function withOpacity(rgbVar: string): string {
  // Tailwind's public Config type doesn't model this (core-supported)
  // function-value pattern for theme colors, hence the cast.
  const resolver = ({ opacityValue }: { opacityValue?: string }) =>
    opacityValue === undefined ? `rgb(var(${rgbVar}))` : `rgb(var(${rgbVar}) / ${opacityValue})`;
  return resolver as unknown as string;
}

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cinerra: {
          bg: "#08080b",
          surface: "#131318",
          surface2: "#1c1c24",
          border: "#28282f",
          // Brand colors resolve through the CSS custom properties defined in
          // globals.css :root — that's the single source of truth. Change the
          // brand there and every cinerra-accent/accent2/gold usage (and the
          // Logo's inline SVG, which reads the same vars directly) follows.
          accent: withOpacity("--brand-primary-start-rgb"),
          accent2: withOpacity("--brand-primary-end-rgb"),
          "accent-hover": withOpacity("--brand-primary-hover-rgb"),
          gold: withOpacity("--accent-coin-rgb"),
          success: withOpacity("--accent-success-rgb"),
          danger: withOpacity("--accent-danger-rgb"),
          text: "#f5f5f7",
          muted: "#9a9aa8",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["'Playfair Display'", "serif"],
      },
      backgroundImage: {
        "cinerra-hero":
          "radial-gradient(120% 140% at 15% -10%, rgba(139,92,246,0.35) 0%, rgba(139,92,246,0) 45%), radial-gradient(100% 120% at 100% 0%, rgba(236,72,153,0.28) 0%, rgba(236,72,153,0) 50%), linear-gradient(160deg, #16162a 0%, #0a0a10 50%, #1f0f24 100%)",
        "cinerra-accent": "linear-gradient(90deg, var(--brand-primary-start) 0%, var(--brand-primary-end) 100%)",
        "cinerra-gold": "linear-gradient(90deg, #f3d59f 0%, #d9a55b 100%)",
        "cinerra-mesh":
          "radial-gradient(60% 50% at 85% -10%, rgba(139,92,246,0.16) 0%, rgba(139,92,246,0) 60%), radial-gradient(50% 40% at 10% 10%, rgba(236,72,153,0.10) 0%, rgba(236,72,153,0) 60%), radial-gradient(40% 30% at 50% 100%, rgba(139,92,246,0.08) 0%, rgba(139,92,246,0) 60%)",
      },
      boxShadow: {
        glow: "0 8px 30px -8px var(--brand-glow)",
        "glow-lg": "0 20px 60px -12px var(--brand-glow)",
        "glow-pink": "0 8px 30px -8px var(--brand-glow-secondary)",
        "glow-gold": "0 8px 24px -6px rgba(238,200,136,0.35)",
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 12px 30px -18px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
};

export default config;
