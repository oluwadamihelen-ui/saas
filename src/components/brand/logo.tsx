import Image from "next/image";
import logoSrc from "../../../public/brand/otelum-logo.png";
import iconSrc from "../../../public/brand/otelum-icon.png";
import { cn } from "@/lib/utils";

/** Icon + wordmark lockup for the platform. */
export function Logo({ height = 32, className }: { height?: number; className?: string }) {
  const width = Math.round((height * logoSrc.width) / logoSrc.height);
  return (
    <Image
      src={logoSrc}
      alt="Otelum"
      height={height}
      width={width}
      priority
      className={cn(className)}
      style={{ height, width: "auto" }}
    />
  );
}

/** Icon-only mark (the doorway/bed glyph), for tight spaces (collapsed nav, loading states). */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <Image
      src={iconSrc}
      alt="Otelum"
      height={size}
      width={size}
      className={cn(className)}
      style={{ height: size, width: size }}
    />
  );
}
