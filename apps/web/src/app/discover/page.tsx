import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { MobileNav, DesktopSidebar } from "@/components/Nav";
import { DiscoverCard } from "@/components/DiscoverCard";
import { EmptyState } from "@/components/EmptyState";
import { listPopularPublications, listNewReleasePublications, type DiscoverCardData } from "@/lib/discover";

export default async function DiscoverPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const [popular, newReleases] = await Promise.all([listPopularPublications(18), listNewReleasePublications(18)]);

  return (
    <div className="min-h-screen">
      <Header />
      <div className="flex">
        <DesktopSidebar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:px-8">
          <h1 className="font-display text-2xl font-bold">Discover</h1>
          <p className="mt-1 text-sm text-cinerra-muted">Movies made by the Cinerra community.</p>

          <Rail title="Popular" items={popular} />
          <Rail title="New Releases" items={newReleases} />
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

function Rail({ title, items }: { title: string; items: DiscoverCardData[] }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 font-display text-xl font-semibold text-cinerra-text">{title}</h2>
      {items.length === 0 ? (
        <EmptyState title="Nothing published yet." description="Public movies from the Cinerra community will appear here once creators start publishing." />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {items.map((item) => (
            <DiscoverCard key={item.publicationId} {...item} />
          ))}
        </div>
      )}
    </section>
  );
}
