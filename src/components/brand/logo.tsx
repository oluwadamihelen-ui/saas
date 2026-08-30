import { cn } from "@/lib/utils";

export function MamaLogo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-extrabold tracking-tight", className)}>
      {/* Sized in em units so it scales with whatever text-size className the caller passes in. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="MAMA"
        className="h-[1.8em] w-[1.8em] shrink-0 rounded-full object-cover"
      />
      {showWordmark && <span>MAMA</span>}
    </span>
  );
}
