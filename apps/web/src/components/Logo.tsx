export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center font-display text-xl font-bold tracking-tight drop-shadow-[0_0_18px_rgba(139,92,246,0.35)] ${className}`}>
      Cine<span className="bg-cinerra-accent bg-clip-text text-transparent">rra</span>
    </span>
  );
}
