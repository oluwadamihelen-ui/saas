import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/Header";
import { MobileNav, DesktopSidebar } from "@/components/Nav";
import { ProjectCard } from "@/components/ProjectCard";
import { DiscoverCard } from "@/components/DiscoverCard";
import { EmptyState } from "@/components/EmptyState";
import { Footer } from "@/components/Footer";
import { listPopularPublications, listNewReleasePublications, type DiscoverCardData } from "@/lib/discover";

export default async function HomePage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const [projects, popular, newReleases] = await Promise.all([
    prisma.project.findMany({ where: { ownerId: userId }, orderBy: { updatedAt: "desc" }, take: 24 }),
    listPopularPublications(6),
    listNewReleasePublications(6),
  ]);

  const generating = projects.filter((p) => p.status === "GENERATING");
  const myMovies = projects;

  return (
    <div className="min-h-screen">
      <Header />
      <div className="flex">
        <DesktopSidebar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:px-8">
          <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-cinerra-hero px-6 py-16 shadow-glow-lg md:px-14 md:py-24">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cinerra-accent2/30 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-cinerra-accent/25 blur-3xl"
            />
            <div className="relative z-10 flex items-center justify-between gap-10">
              <div className="max-w-xl">
                <span className="eyebrow">Cinematic AI Studio</span>
                <h1 className="mt-3 font-display text-4xl font-bold leading-[1.05] text-white md:text-6xl">
                  Create your next movie with AI.
                </h1>
                <p className="mt-5 max-w-md text-base text-white/70 md:text-lg">
                  From idea to finished film — story, cast, cinematography, and score, generated end to end.
                </p>
                <div className="mt-9 flex flex-wrap gap-3">
                  <Link href="/projects/new?mode=INSPIRATION" className="btn-primary px-7 py-3.5 text-base">
                    Create Movie
                  </Link>
                  <Link href="/projects/new?mode=ADAPTATION" className="btn-outline-light">
                    Adapt a Story
                  </Link>
                </div>
              </div>
              <FeaturedFilmCard />
            </div>
          </section>

          {generating.length > 0 && (
            <Section title="Continue Creating">
              <CardGrid projects={generating} />
            </Section>
          )}

          <Section title="My Movies">
            {myMovies.length === 0 ? (
              <EmptyState
                title="No movies yet."
                description="Your first story is waiting."
                ctaLabel="Create Movie"
                ctaHref="/projects/new"
              />
            ) : (
              <CardGrid projects={myMovies} />
            )}
          </Section>

          <Section title="Popular">
            {popular.length === 0 ? (
              <EmptyState title="Nothing published yet." description="Public movies from the FilmDoe community will appear here once creators start publishing." ctaLabel="Browse Discover" ctaHref="/discover" />
            ) : (
              <DiscoverGrid items={popular} />
            )}
          </Section>

          <Section title="New Releases">
            {newReleases.length === 0 ? (
              <EmptyState title="No new releases yet." description="Recently published productions will show up here." />
            ) : (
              <DiscoverGrid items={newReleases} />
            )}
          </Section>
        </main>
      </div>
      <Footer />
      <MobileNav />
    </div>
  );
}

function FeaturedFilmCard() {
  return (
    <div className="hidden shrink-0 lg:block">
      <div className="group relative w-56 rotate-3 rounded-2xl border border-white/15 bg-gradient-to-br from-cinerra-accent/40 via-[#2a1140] to-cinerra-bg shadow-glow-lg transition duration-300 hover:rotate-0">
        <div className="aspect-[2/3] overflow-hidden rounded-2xl">
          <div className="relative flex h-full flex-col justify-between p-4">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_20%_0%,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0)_55%)]"
            />
            <span className="relative w-fit rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur">
              AI Generated
            </span>

            <div className="relative flex flex-1 items-center justify-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/30 bg-white/10 backdrop-blur transition group-hover:scale-105 group-hover:bg-white/20">
                <PlayIcon />
              </span>
            </div>

            <div className="relative">
              <p className="font-display text-lg font-bold leading-tight text-white">The Last Horizon</p>
              <p className="mt-1 text-[11px] text-white/60">Sci-Fi · Feature Film</p>
              <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-cinerra-gold">
                <StarIcon />
                4.9 <span className="text-white/40">rating</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
    </svg>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="mb-4 font-display text-xl font-semibold text-cinerra-text">{title}</h2>
      {children}
    </section>
  );
}

function CardGrid({ projects }: { projects: Array<{ id: string; title: string; status: string; episodeCount: number; updatedAt: Date; visualStyle: string }> }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {projects.map((p) => (
        <ProjectCard key={p.id} id={p.id} title={p.title} status={p.status} episodeCount={p.episodeCount} updatedAt={p.updatedAt} visualStyle={p.visualStyle} />
      ))}
    </div>
  );
}

function DiscoverGrid({ items }: { items: DiscoverCardData[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {items.map((item) => (
        <DiscoverCard key={item.publicationId} {...item} />
      ))}
    </div>
  );
}
