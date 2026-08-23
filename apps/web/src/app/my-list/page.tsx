import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Header } from "@/components/Header";
import { MobileNav, DesktopSidebar } from "@/components/Nav";
import { DiscoverCard } from "@/components/DiscoverCard";
import { EmptyState } from "@/components/EmptyState";
import { listUserFavorites } from "@/lib/discover";

export default async function MyListPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const favorites = await listUserFavorites(userId);

  return (
    <div className="min-h-screen">
      <Header />
      <div className="flex">
        <DesktopSidebar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:px-8">
          <h1 className="font-display text-2xl font-bold">My List</h1>
          <p className="mt-1 text-sm text-cinerra-muted">Movies you've saved from Discover.</p>

          <div className="mt-8">
            {favorites.length === 0 ? (
              <EmptyState title="Nothing saved yet." description="Save movies from Discover and they'll show up here." ctaLabel="Browse Discover" ctaHref="/discover" />
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {favorites.map((item) => (
                  <DiscoverCard key={item.publicationId} {...item} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
