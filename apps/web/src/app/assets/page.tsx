import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAssetDisplayUrl } from "@/lib/storage";
import { Header } from "@/components/Header";
import { MobileNav, DesktopSidebar } from "@/components/Nav";
import { AssetCard, type AssetCardData } from "@/components/AssetCard";
import { EmptyState } from "@/components/EmptyState";

const TYPE_TABS = [
  { key: "ALL", label: "All" },
  { key: "IMAGE", label: "Images" },
  { key: "VIDEO", label: "Video" },
  { key: "AUDIO", label: "Audio" },
  { key: "DOCUMENT", label: "Documents" },
] as const;

const PAGE_SIZE = 60;

export default async function AssetsPage({ searchParams }: { searchParams: { type?: string; project?: string } }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const projects = await prisma.project.findMany({
    where: { ownerId: userId },
    select: { id: true, title: true },
    orderBy: { updatedAt: "desc" },
  });

  const type = TYPE_TABS.some((t) => t.key === searchParams.type) ? searchParams.type! : "ALL";
  const projectFilter = projects.some((p) => p.id === searchParams.project) ? searchParams.project : undefined;

  const where = {
    project: { ownerId: userId },
    ...(type !== "ALL" ? { type: type as "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" } : {}),
    ...(projectFilter ? { projectId: projectFilter } : {}),
  };

  const [assets, totalCount] = await Promise.all([
    prisma.asset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      include: { project: { select: { title: true } } },
    }),
    prisma.asset.count({ where }),
  ]);

  const assetCards: AssetCardData[] = await Promise.all(
    assets.map(async (a) => ({
      id: a.id,
      type: a.type,
      kind: a.kind,
      url: await getAssetDisplayUrl(a.storageKey),
      bytes: a.bytes,
      durationSeconds: a.durationSeconds,
      createdAt: a.createdAt,
      projectTitle: a.project.title,
    })),
  );

  return (
    <div className="min-h-screen">
      <Header />
      <div className="flex">
        <DesktopSidebar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:px-8">
          <h1 className="font-display text-2xl font-bold">Media Library</h1>
          <p className="mt-1 text-sm text-cinerra-muted">Every image, video, and audio clip generated across your movies.</p>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex w-fit gap-1 rounded-full border border-cinerra-border bg-cinerra-surface p-1 text-sm">
              {TYPE_TABS.map((t) => (
                <Link
                  key={t.key}
                  href={`/assets?type=${t.key}${projectFilter ? `&project=${projectFilter}` : ""}`}
                  className={`rounded-full px-4 py-1.5 font-medium ${type === t.key ? "bg-cinerra-accent text-white" : "text-cinerra-muted"}`}
                >
                  {t.label}
                </Link>
              ))}
            </div>

            {projects.length > 0 && (
              <form className="flex items-center gap-2">
                <input type="hidden" name="type" value={type} />
                <select name="project" defaultValue={projectFilter ?? ""} className="input w-auto py-1.5 text-sm">
                  <option value="">All projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn-secondary-sm">
                  Filter
                </button>
              </form>
            )}
          </div>

          <div className="mt-6">
            {assetCards.length === 0 ? (
              <EmptyState
                title="No media yet."
                description="Generated characters, locations, shots, and audio will show up here as you create."
                ctaLabel="Create Movie"
                ctaHref="/projects/new"
              />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {assetCards.map((asset) => (
                    <AssetCard key={asset.id} asset={asset} showProject={!projectFilter} />
                  ))}
                </div>
                {totalCount > PAGE_SIZE && (
                  <p className="mt-4 text-center text-xs text-cinerra-muted">
                    Showing the {PAGE_SIZE} most recent of {totalCount} assets. Filter by project to narrow this down.
                  </p>
                )}
              </>
            )}
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
