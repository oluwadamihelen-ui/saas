import { FilmDoeIcon } from "./FilmDoeIcon";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display text-xl font-bold tracking-tight text-cinerra-text ${className}`}>
      <FilmDoeIcon className="h-6 w-6 shrink-0 drop-shadow-[0_0_10px_rgba(249,115,22,0.35)]" />
      <span>Film<span className="bg-gradient-to-r from-amber-300 via-orange-500 to-red-600 bg-clip-text text-transparent">Doe</span></span>
    </span>
  );
}
