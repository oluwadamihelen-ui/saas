import Image from "next/image";
import { cn } from "@/lib/utils";
import { brand } from "@/lib/brand";

const LOCKUP_ASPECT = 1650 / 302;

/// The Schoolum product wordmark — rendered on the platform's own chrome
/// (login, register, platform admin, marketing site, sidebar header).
/// Uses the actual brand lockup image (public/brand/schoolum-logo*.png),
/// never a redrawn stand-in, so the product mark stays pixel-identical
/// everywhere it appears.
///
/// `variant="light"` swaps to the white-text lockup for a dark surface
/// (the navy sidebar, the auth panel, a dark marketing section).
/// `iconOnly` renders just the graduation-cap "S" mark (square asset) for
/// tight spaces — a collapsed sidebar rail, a mobile app icon preview.
export function Logo({
  height = 28,
  className,
  variant = "dark",
  iconOnly = false,
}: {
  height?: number;
  className?: string;
  variant?: "dark" | "light";
  iconOnly?: boolean;
}) {
  if (iconOnly) {
    return (
      <Image
        src="/brand/schoolum-icon.png"
        alt={brand.name}
        height={height}
        width={height}
        className={cn("shrink-0 object-contain", className)}
        priority
      />
    );
  }

  const src = variant === "light" ? "/brand/schoolum-logo-light.png" : "/brand/schoolum-logo.png";
  const width = Math.round(height * LOCKUP_ASPECT);

  return (
    <Image
      src={src}
      alt={brand.name}
      height={height}
      width={width}
      className={cn("shrink-0 object-contain", className)}
      style={{ height, width: "auto" }}
      priority
    />
  );
}
