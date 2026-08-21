import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cinerra: {
          bg: "#0a0a0d",
          surface: "#131318",
          surface2: "#1b1b22",
          border: "#26262f",
          accent: "#8b5cf6",
          accent2: "#ec4899",
          text: "#f4f4f6",
          muted: "#9a9aa8",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["'Playfair Display'", "serif"],
      },
      backgroundImage: {
        "cinerra-hero": "linear-gradient(135deg, #1b1b3a 0%, #0a0a0d 55%, #2a0f2e 100%)",
        "cinerra-accent": "linear-gradient(90deg, #8b5cf6 0%, #ec4899 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
