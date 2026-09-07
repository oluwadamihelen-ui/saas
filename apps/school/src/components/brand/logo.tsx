import { cn } from "@/lib/utils";

export function Logo({ height = 28, className }: { height?: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-2 font-semibold tracking-tight text-foreground", className)}
      style={{ fontSize: height * 0.6 }}
    >
      <span
        className="flex items-center justify-center rounded-md bg-accent font-bold text-accent-foreground"
        style={{ height, width: height, fontSize: height * 0.5 }}
      >
        W
      </span>
      Winfield
    </span>
  );
}
