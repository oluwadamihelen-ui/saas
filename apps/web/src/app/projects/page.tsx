import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireAcceptedTerms } from "@/lib/authGuards";
import { prisma } from "@/lib/db";
import { Header } from "@/components/Header";
import { MobileNav } from "@/components/Nav";
import { ProjectCard } from "@/components/ProjectCard";
import { DiscoverCard } from "@/components/DiscoverCard";
import { EmptyState } from "@/components/EmptyState";
import { listUserFavorites } from "@/lib/discover";

const TABS = [
  { key: "creations", label: "My Creations" },
  { key: "history", label: "History" },
  { key: "collection", label: "Collection" },
];

export default async function ProjectsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");
  requireAcceptedTerms(session, "/projects");

  const tab = TABS.some((t) => t.key === searchParams.tab) ? searchParams.tab! : "creations";

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 md:px-8">
        <h1 className="font-display text-2xl font-bold">Projects</h1>
        <div className="mt-4 flex gap-1 rounded-full border border-cinerra-border bg-cinerra-surface p-1 text-sm w-fit">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/projects?tab=${t.key}`}
              className={`rounded-full px-4 py-1.5 font-medium ${tab === t.key ? "bg-cinerra-accent text-white" : "text-cinerra-muted"}`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <div className="mt-6">
          {tab === "creations" && <MyCreations userId={userId} />}
          {tab === "history" && <History userId={userId} />}
          {tab === "collection" && <Collection userId={userId} />}
        </div>
      </main>
      <MobileNav />
    </div>
  );
}

async function MyCreations({ userId }: { userId: string }) {
  const projects = await prisma.project.findMany({ where: { ownerId: userId }, orderBy: { updatedAt: "desc" } });
  if (projects.length === 0) {
    return <EmptyState title="No movies yet." description="Your first story is waiting." ctaLabel="Create Movie" ctaHref="/projects/new" />;
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {projects.map((p) => (
        <ProjectCard key={p.id} id={p.id} title={p.title} status={p.status} episodeCount={p.episodeCount} updatedAt={p.updatedAt} visualStyle={p.visualStyle} />
      ))}
    </div>
  );
}

async function Collection({ userId }: { userId: string }) {
  const favorites = await listUserFavorites(userId);
  if (favorites.length === 0) {
    return <EmptyState title="No saved movies yet." description="Movies you save from Discover will appear here." ctaLabel="Browse Discover" ctaHref="/discover" />;
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {favorites.map((item) => (
        <DiscoverCard key={item.publicationId} {...item} />
      ))}
    </div>
  );
}

async function History({ userId }: { userId: string }) {
  const jobs = await prisma.generationJob.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { project: { select: { title: true } } },
  });
  if (jobs.length === 0) {
    return <EmptyState title="No activity yet." description="Your generation history will show up here as you create." />;
  }
  return (
    <div className="flex flex-col divide-y divide-cinerra-border rounded-xl border border-cinerra-border">
      {jobs.map((job) => (
        <div key={job.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
          <div>
            <p className="font-medium">{job.type.replace(/_/g, " ")}</p>
            <p className="text-xs text-cinerra-muted">{job.project.title}</p>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] ${
              job.status === "SUCCEEDED" ? "bg-emerald-500/15 text-emerald-300" : job.status === "FAILED" ? "bg-red-500/15 text-red-300" : "bg-cinerra-surface2 text-cinerra-muted"
            }`}
          >
            {job.status}
          </span>
        </div>
      ))}
    </div>
  );
}
