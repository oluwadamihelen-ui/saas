import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/Header";
import { MobileNav, DesktopSidebar } from "@/components/Nav";
import { ProjectCard } from "@/components/ProjectCard";
import { EmptyState } from "@/components/EmptyState";

export default async function HomePage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const projects = await prisma.project.findMany({
    where: { ownerId: userId },
    orderBy: { updatedAt: "desc" },
    take: 24,
  });

  const generating = projects.filter((p) => p.status === "GENERATING");
  const myMovies = projects;

  return (
    <div className="min-h-screen">
      <Header />
      <div className="flex">
        <DesktopSidebar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:px-8">
          <section className="relative overflow-hidden rounded-2xl bg-cinerra-hero px-6 py-14 md:px-12 md:py-20">
            <div className="relative z-10 max-w-xl">
              <h1 className="font-display text-3xl font-bold leading-tight text-white md:text-5xl">
                Create your next movie with AI.
              </h1>
              <p className="mt-4 text-base text-white/70 md:text-lg">From idea to finished film.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/projects/new?mode=INSPIRATION"
                  className="rounded-full bg-cinerra-accent px-6 py-3 text-sm font-semibold text-white hover:brightness-110"
                >
                  Create Movie
                </Link>
                <Link
                  href="/projects/new?mode=ADAPTATION"
                  className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Adapt a Story
                </Link>
              </div>
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
            <EmptyState title="Nothing published yet." description="Public movies from the Cinerra community will appear here once creators start publishing." />
          </Section>

          <Section title="New Releases">
            <EmptyState title="No new releases yet." description="Recently published productions will show up here." />
          </Section>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-lg font-semibold text-cinerra-text">{title}</h2>
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
