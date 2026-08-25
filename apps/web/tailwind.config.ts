import type { Config } from "tailwindcss";

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
          accent: "#8b5cf6",
          accent2: "#ec4899",
          gold: "#eec888",
          text: "#f5f5f7",
          muted: "#9a9aa8",
        },
        rewards: {
          cream: "#fbf5ec",
          cream2: "#f5efe4",
          ink: "#141110",
          orange: "#f97316",
          orange2: "#ea580c",
          "orange-light": "#fdba74",
          muted: "#6b7280",
          border: "#ece3d4",
          purple: "#8b5cf6",
          green: "#16a34a",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["'Playfair Display'", "serif"],
      },
      backgroundImage: {
        "cinerra-hero":
          "radial-gradient(120% 140% at 15% -10%, rgba(139,92,246,0.35) 0%, rgba(139,92,246,0) 45%), radial-gradient(100% 120% at 100% 0%, rgba(236,72,153,0.28) 0%, rgba(236,72,153,0) 50%), linear-gradient(160deg, #16162a 0%, #0a0a10 50%, #1f0f24 100%)",
        "cinerra-accent": "linear-gradient(90deg, #8b5cf6 0%, #ec4899 100%)",
        "cinerra-gold": "linear-gradient(90deg, #f3d59f 0%, #d9a55b 100%)",
        "cinerra-mesh":
          "radial-gradient(60% 50% at 85% -10%, rgba(139,92,246,0.16) 0%, rgba(139,92,246,0) 60%), radial-gradient(50% 40% at 10% 10%, rgba(236,72,153,0.10) 0%, rgba(236,72,153,0) 60%), radial-gradient(40% 30% at 50% 100%, rgba(139,92,246,0.08) 0%, rgba(139,92,246,0) 60%)",
        "rewards-hero": "radial-gradient(80% 60% at 20% 0%, rgba(249,115,22,0.14) 0%, rgba(249,115,22,0) 55%), linear-gradient(180deg, #fdf3e7 0%, #fbf5ec 40%, #fbf5ec 100%)",
        "rewards-orange": "linear-gradient(135deg, #fdba74 0%, #f97316 45%, #ea580c 100%)",
        "rewards-step": "radial-gradient(120% 100% at 30% 0%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 45%), linear-gradient(160deg, #fdba74 0%, #f97316 55%, #ea580c 100%)",
        "rewards-band": "linear-gradient(180deg, rgba(249,115,22,0) 0%, rgba(249,115,22,0.85) 45%, #ea580c 100%)",
      },
      boxShadow: {
        glow: "0 8px 30px -8px rgba(139,92,246,0.45)",
        "glow-lg": "0 20px 60px -12px rgba(139,92,246,0.5)",
        "glow-pink": "0 8px 30px -8px rgba(236,72,153,0.4)",
        "glow-gold": "0 8px 24px -6px rgba(238,200,136,0.35)",
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 12px 30px -18px rgba(0,0,0,0.6)",
        "rewards-card": "0 16px 40px -20px rgba(20,17,16,0.18)",
        "rewards-glow": "0 10px 28px -8px rgba(249,115,22,0.5)",
      },
    },
  },
  plugins: [],
};

export default config;
