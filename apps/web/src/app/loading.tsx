import { Logo } from "@/components/Logo";

/**
 * App Router shows this the INSTANT a navigation starts, before the
 * destination route's server component (and whatever data it awaits) has
 * resolved — this is what makes clicks feel instant even when the actual
 * page takes a moment to render, rather than the browser just sitting on
 * the old page with no feedback until everything is ready. Applies to any
 * route that doesn't define its own more specific loading.tsx.
 */
export default function RootLoading() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-cinerra-border/70 bg-cinerra-bg/80 px-4 backdrop-blur-md md:px-8">
        <Logo />
        <div className="h-9 w-9 animate-pulse rounded-full bg-cinerra-surface" />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-12 md:px-8">
        <div className="animate-pulse space-y-6">
          <div className="h-7 w-48 rounded bg-cinerra-surface" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 rounded-xl border border-cinerra-border/80 bg-cinerra-surface" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
