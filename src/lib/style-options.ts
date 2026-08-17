export const VISUAL_STYLES = [
  { value: "MODERN_CARTOON", label: "Modern Cartoon", gradient: "from-brand-400 to-brand-600" },
  { value: "STORYBOOK", label: "Storybook", gradient: "from-ember-400 to-ember-600" },
  { value: "COMIC", label: "Comic", gradient: "from-brand-500 to-ember-500" },
  { value: "THREE_D_ANIMATION", label: "3D Animation", gradient: "from-brand-300 to-brand-700" },
  { value: "MINIMAL_ILLUSTRATION", label: "Minimal Illustration", gradient: "from-ember-300 to-ember-600" },
  { value: "HAND_DRAWN", label: "Hand Drawn", gradient: "from-brand-400 to-ember-400" },
  { value: "CINEMATIC_CARTOON", label: "Cinematic Cartoon", gradient: "from-brand-700 to-brand-400" },
  { value: "EDUCATIONAL", label: "Educational", gradient: "from-brand-500 to-ember-400" },
  { value: "KIDS_ANIMATION", label: "Kids Animation", gradient: "from-ember-400 to-brand-400" },
  { value: "DOCUMENTARY_ILLUSTRATION", label: "Documentary Illustration", gradient: "from-brand-600 to-ember-600" },
] as const;

export const ASPECT_RATIOS = [
  { value: "RATIO_16_9", label: "16:9", hint: "Widescreen — YouTube, web", boxClass: "aspect-video w-14" },
  { value: "RATIO_9_16", label: "9:16", hint: "Vertical — Shorts, Reels, TikTok", boxClass: "aspect-[9/16] w-8" },
  { value: "RATIO_1_1", label: "1:1", hint: "Square — social feed", boxClass: "aspect-square w-10" },
] as const;
