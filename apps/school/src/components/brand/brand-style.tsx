import { buildBrandTokens, isValidHexColor } from "@/lib/color";

/// Recolors --accent/--accent-soft/--accent-foreground for the rest of
/// this request's render — every component that already reads those
/// tokens (buttons, badges, links, the sidebar's active state) picks up a
/// school's brand color with no per-component change. Mounted once per
/// school-facing layout (dashboard, portal, apply, pay); omitted entirely
/// — falling back to globals.css's default Winfield blue — when a school
/// hasn't set one, or renders on Winfield's own chrome (login, platform).
export function BrandStyle({ color }: { color?: string | null }) {
  if (!color || !isValidHexColor(color)) return null;
  const { accent, accentSoft, accentForeground } = buildBrandTokens(color);

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `:root{--accent:${accent};--accent-soft:${accentSoft};--accent-foreground:${accentForeground};}`,
      }}
    />
  );
}
