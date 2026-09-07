import Image from "next/image";
import logoSrc from "../../../public/brand/bridgecodes-logo.png";
import iconSrc from "../../../public/brand/bridgecodes-icon.png";

/**
 * Full lockup (icon + "BridgeCodes" wordmark). The source PNG already has a
 * transparent background, so it drops cleanly onto any of the app's surface
 * tokens (all light) without a bounding box.
 */
export function Logo({ height = 32, className }: { height?: number; className?: string }) {
  const width = Math.round((height * logoSrc.width) / logoSrc.height);
  return (
    <Image
      src={logoSrc}
      alt="BridgeCodes"
      height={height}
      width={width}
      priority
      className={className}
      style={{ height, width: "auto" }}
    />
  );
}

/** Icon-only mark ("B"), for tight spaces (collapsed nav, loading states). */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return <Image src={iconSrc} alt="BridgeCodes" height={size} width={size} className={className} style={{ height: size, width: size }} />;
}
