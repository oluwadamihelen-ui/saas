import { cn } from "@/lib/utils";

/// `variant="light"` swaps the wordmark to white for use on a dark
/// section (e.g. the marketing footer or a dark CTA band) — every
/// existing call site omits this prop and keeps today's dark-on-light
/// look untouched.
export function Logo({
  height = 28,
  className,
  variant = "dark",
}: {
  height?: number;
  className?: string;
  variant?: "dark" | "light";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-semibold tracking-tight",
        variant === "light" ? "text-white" : "text-foreground",
        className
      )}
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
