import { cn } from "@/lib/utils";

export function MamaLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-extrabold tracking-tight", className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-base">
        M
      </span>
      <span>MAMA</span>
    </span>
  );
}
