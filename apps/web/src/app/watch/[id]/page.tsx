import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAssetDisplayUrl } from "@/lib/storage";
import { recordPublicationView } from "@cinerra/domain";
import { Header } from "@/components/Header";
import { MobileNav } from "@/components/Nav";
import { FavoriteButton } from "@/components/FavoriteButton";

export default async function WatchPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  const publication = await prisma.publication.findUnique({
    where: { id: params.id },
    include: {
      publishedBy: { select: { name: true } },
      project: {
        include: {
          storyBible: { select: { logline: true, genres: true } },
          episodes: {
            orderBy: { number: "asc" },
            include: { exports: { where: { kind: "EPISODE", status: "SUCCEEDED" }, orderBy: { createdAt: "desc" }, take: 1 } },
          },
        },
      },
      // Always include with a concrete filter (rather than a conditional
      // `false` branch) so the result shape stays uniform — an unset
      // userId falls back to a filter that can never match a real row.
      favorites: { where: { userId: userId ?? "__anonymous__" }, select: { id: true } },
    },
  });

  if (!publication || publication.visibility !== "PUBLIC") notFound();

  await recordPublicationView(publication.id);

  const episodesWithVideo = await Promise.all(
    publication.project.episodes
      .filter((e) => e.exports[0]?.assetKey)
      .map(async (e) => ({
        id: e.id,
        number: e.number,
        title: e.title,
        videoUrl: await getAssetDisplayUrl(e.exports[0]!.assetKey!),
      })),
  );

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-4xl px-4 pb-24 pt-6 md:px-8">
        {episodesWithVideo.length === 0 ? (
          <p className="rounded-xl border border-cinerra-border bg-cinerra-surface p-6 text-sm text-cinerra-muted">
            This movie's video isn't available right now.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-cinerra-border bg-black shadow-card">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video key={episodesWithVideo[0]!.id} src={episodesWithVideo[0]!.videoUrl} controls className="aspect-video w-full bg-black" />
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-cinerra-text md:text-3xl">{publication.project.title}</h1>
            <p className="mt-1 text-sm text-cinerra-muted">
              By {publication.publishedBy.name ?? "A Cinerra creator"} · {publication.views.toLocaleString()} views · {publication.saves.toLocaleString()} saves
            </p>
            {publication.project.storyBible?.genres?.length ? (
              <p className="mt-2 text-xs uppercase tracking-wide text-cinerra-accent2">{publication.project.storyBible.genres.join(" · ")}</p>
            ) : null}
          </div>
          {userId ? (
            <FavoriteButton publicationId={publication.id} initiallyFavorited={publication.favorites.length > 0} />
          ) : (
            <Link href="/login" className="btn-secondary-sm">
              Sign in to save
            </Link>
          )}
        </div>

        {publication.project.storyBible?.logline && (
          <p className="mt-4 max-w-2xl text-sm text-cinerra-text/90">{publication.project.storyBible.logline}</p>
        )}

        {episodesWithVideo.length > 1 && (
          <div className="mt-8">
            <h2 className="mb-3 font-display text-lg font-semibold text-cinerra-text">Episodes</h2>
            <div className="flex flex-col divide-y divide-cinerra-border rounded-xl border border-cinerra-border">
              {episodesWithVideo.map((e) => (
                <a key={e.id} href={e.videoUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between px-4 py-3 text-sm hover:bg-cinerra-surface2/50">
                  <span>
                    Ep {e.number} — {e.title}
                  </span>
                  <span className="text-cinerra-muted">Watch →</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </main>
      <MobileNav />
    </div>
  );
}
