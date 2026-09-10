import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Icon + wordmark lockup for the platform. */
export function Logo({ height = 32, className }: { height?: number; className?: string }) {
  const iconSize = Math.round(height * 0.68);
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight text-foreground", className)} style={{ fontSize: height * 0.5 }}>
      <span
        className="inline-flex items-center justify-center rounded-md bg-accent text-accent-foreground"
        style={{ height, width: height }}
      >
        <Building2 style={{ height: iconSize, width: iconSize }} />
      </span>
      StayOS
    </span>
  );
}

/** Icon-only mark, for tight spaces (collapsed nav, loading states). */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  const iconSize = Math.round(size * 0.62);
  return (
    <span
      className={cn("inline-flex items-center justify-center rounded-md bg-accent text-accent-foreground", className)}
      style={{ height: size, width: size }}
    >
      <Building2 style={{ height: iconSize, width: iconSize }} />
    </span>
  );
}
