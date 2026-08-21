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
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-cinerra-border py-16 text-center">
      <p className="text-lg font-semibold text-cinerra-text">{title}</p>
      <p className="max-w-sm text-sm text-cinerra-muted">{description}</p>
      {ctaLabel && ctaHref && (
        <Link href={ctaHref} className="mt-2 rounded-full bg-cinerra-accent px-5 py-2 text-sm font-medium text-white hover:brightness-110">
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
