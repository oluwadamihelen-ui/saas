import { cn } from "@/lib/utils";

/// The tenant-branded counterpart to <Logo> (which always renders the
/// Winfield product mark, used on login/register/platform chrome). Shows
/// a school's uploaded image when set; otherwise falls back to the same
/// lettermark style as <Logo>, generated from the school's own name/
/// initial instead of "Winfield" — so an unbranded school still looks
/// like itself, not like the product vendor.
export function SchoolLogo({
  name,
  logoUrl,
  height = 26,
  className,
}: {
  name: string;
  logoUrl?: string | null;
  height?: number;
  className?: string;
}) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- logoUrl is a data: URL (uploaded, no external host), which next/image cannot optimize anyway.
    return <img src={logoUrl} alt={name} className={cn("object-contain", className)} style={{ height, maxWidth: height * 6 }} />;
  }

  const initial = name.trim().charAt(0).toUpperCase() || "S";
  return (
    <span
      className={cn("inline-flex items-center gap-2 font-semibold tracking-tight text-foreground", className)}
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
