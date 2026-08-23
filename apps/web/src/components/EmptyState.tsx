import Link from "next/link";

export interface EmptyStateProps {
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
}

/** Reusable empty state (spec §78) — never a blank screen. */
export function EmptyState({ title, description, ctaLabel, ctaHref }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-cinerra-border/80 bg-cinerra-surface/30 py-16 text-center">
      <p className="font-display text-lg font-semibold text-cinerra-text">{title}</p>
      <p className="max-w-sm text-sm text-cinerra-muted">{description}</p>
      {ctaLabel && ctaHref && (
        <Link href={ctaHref} className="btn-primary-sm mt-2">
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
