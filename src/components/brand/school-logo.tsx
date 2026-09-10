import { cn } from "@/lib/utils";

/// The tenant-branded counterpart to <Logo> (which always renders the
/// Schoolum product mark, used on login/register/platform chrome). Shows
/// a school's uploaded image when set; otherwise falls back to the same
/// lettermark style as <Logo>, generated from the school's own name/
/// initial instead of "Schoolum" — so an unbranded school still looks
/// like itself, not like the product vendor.
///
/// `variant="navy"` is for the dark sidebar rail: the fallback lettermark
/// switches to white text, and an uploaded logo (which could be any
/// color, including dark-on-transparent) sits on a small white plate so
/// it stays legible regardless of what the school uploaded.
export function SchoolLogo({
  name,
  logoUrl,
  height = 26,
  className,
  variant = "light",
}: {
  name: string;
  logoUrl?: string | null;
  height?: number;
  className?: string;
  variant?: "light" | "navy";
}) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- logoUrl is a data: URL (uploaded, no external host), which next/image cannot optimize anyway.
    const img = <img src={logoUrl} alt={name} className={cn("object-contain", className)} style={{ height, maxWidth: height * 6 }} />;
    if (variant === "navy") {
      return (
        <span className="inline-flex items-center rounded-md bg-white px-2 py-1">
          {img}
        </span>
      );
    }
    return img;
  }

  const initial = name.trim().charAt(0).toUpperCase() || "S";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-semibold tracking-tight",
        variant === "navy" ? "text-white" : "text-foreground",
        className
      )}
      style={{ fontSize: height * 0.6 }}
    >
      <span
        className="flex items-center justify-center rounded-md bg-accent font-bold text-accent-foreground"
        style={{ height, width: height, fontSize: height * 0.5 }}
      >
        {initial}
      </span>
      {name}
    </span>
  );
}
