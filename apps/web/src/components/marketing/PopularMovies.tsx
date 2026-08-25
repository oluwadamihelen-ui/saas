import Link from "next/link";
import type { DiscoverCardData } from "@/lib/discover";

/** Logged-out "popular on Cinerra" grid — real published movies, styled to match the landing page. */
export function PopularMovies({ items }: { items: DiscoverCardData[] }) {
  if (items.length === 0) return null;

  return (
    <section className="bg-rewards-cream px-4 py-20 md:px-8">
      <div className="mx-auto max-w-6xl text-center">
        <span className="rewards-badge">
          <DotIcon /> Trending Now <DotIcon />
        </span>
        <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-rewards-ink md:text-5xl">
          Discover Popular Movies
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-rewards-muted">
          Real films made on Cinerra by the community — watch instantly, no signup required.
        </p>

        <div className="mt-14 grid gap-6 text-left sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Link key={item.publicationId} href={`/watch/${item.publicationId}`} className="rewards-card group overflow-hidden transition hover:-translate-y-0.5">
              <div className="relative aspect-video overflow-hidden bg-rewards-cream2">
                {item.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.posterUrl} alt={item.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs font-medium text-rewards-muted">
                    {item.visualStyle.replace(/_/g, " ")}
                  </div>
                )}
                <span className="rewards-tag absolute right-3 top-3">{item.visualStyle.replace(/_/g, " ")}</span>
              </div>
              <div className="p-4">
                <h3 className="line-clamp-1 text-sm font-bold text-rewards-ink">{item.title}</h3>
                <p className="mt-1 text-xs text-rewards-muted">by {item.ownerName}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-rewards-border pt-3 text-center">
                  <div>
                    <p className="text-sm font-bold text-rewards-green">{formatCount(item.views)}</p>
                    <p className="text-[10px] uppercase tracking-wide text-rewards-muted">Views</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-rewards-green">{formatCount(item.saves)}</p>
                    <p className="text-[10px] uppercase tracking-wide text-rewards-muted">Saves</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <Link href="/discover" className="rewards-btn-dark mt-12 inline-flex">
          Browse All Movies <ArrowIcon />
        </Link>
      </div>
    </section>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function DotIcon() {
  return <span className="h-1.5 w-1.5 rounded-full bg-white/60" />;
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
