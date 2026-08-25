import { FilmDoeIcon } from "./FilmDoeIcon";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display text-xl font-bold tracking-tight text-cinerra-text ${className}`}>
      <FilmDoeIcon className="h-6 w-6 shrink-0 drop-shadow-[0_0_10px_var(--brand-glow)]" />
      <span>Film<span className="bg-cinerra-accent bg-clip-text text-transparent">Doe</span></span>
    </span>
  );
}
