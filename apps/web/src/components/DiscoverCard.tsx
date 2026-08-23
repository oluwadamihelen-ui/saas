import Link from "next/link";
import type { DiscoverCardData } from "@/lib/discover";

/** A published movie's poster card in Discover, the home page rails, and My List. */
export function DiscoverCard({ publicationId, title, visualStyle, ownerName, views, posterUrl }: DiscoverCardData) {
  return (
    <Link
      href={`/watch/${publicationId}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-cinerra-border/80 bg-cinerra-surface shadow-card transition duration-200 hover:-translate-y-1 hover:border-cinerra-accent/50 hover:shadow-glow"
    >
      <div className="relative flex aspect-[2/3] items-center justify-center overflow-hidden bg-gradient-to-br from-cinerra-surface2 via-cinerra-surface to-cinerra-bg text-cinerra-muted">
        {posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={posterUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <span className="relative px-4 text-center text-sm">{visualStyle.replace(/_/g, " ")}</span>
        )}
        <div
          aria-hidden
          className="absolute inset-0 bg-cinerra-accent opacity-0 transition-opacity duration-300 group-hover:opacity-10"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-1 text-sm font-semibold text-cinerra-text">{title}</h3>
        <div className="flex items-center justify-between text-xs text-cinerra-muted">
          <span className="line-clamp-1">{ownerName}</span>
          <span>{views.toLocaleString()} views</span>
        </div>
      </div>
    </Link>
  );
}
