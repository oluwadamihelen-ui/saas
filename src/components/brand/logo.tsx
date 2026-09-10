import { cn } from "@/lib/utils";
import { brand } from "@/lib/brand";

/// The Schoolum product wordmark — rendered on the platform's own chrome
/// (login, register, platform admin, marketing site). `variant="light"`
/// swaps it to white for a dark section (marketing footer, a dark CTA
/// band); every existing call site omits this prop and keeps today's
/// dark-on-light look untouched.
///
/// The mark is a rounded square split into two tones (an open "book/
/// window" motif) rather than a plain letter tile, so Schoolum reads as
/// its own product even before the wordmark text loads.
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
      <svg
        width={height}
        height={height}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="32" height="32" rx="9" fill="var(--accent)" />
        <path d="M9 21.5V11l7-3 7 3v10.5" stroke="var(--accent-foreground)" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M13 21.5v-6.2a3 3 0 0 1 3-3v0a3 3 0 0 1 3 3v6.2" stroke="var(--accent-foreground)" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      {brand.name}
    </span>
  );
}
