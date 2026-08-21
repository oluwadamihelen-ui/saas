export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display text-xl font-bold tracking-tight ${className}`}>
      Cine<span className="bg-cinerra-accent bg-clip-text text-transparent">rra</span>
    </span>
  );
}
