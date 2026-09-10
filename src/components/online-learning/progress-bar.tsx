export function ProgressBar({ percent, className }: { percent: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-muted-surface ${className ?? ""}`}>
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${clamped}%` }} />
    </div>
  );
}
