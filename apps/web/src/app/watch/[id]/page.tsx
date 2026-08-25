import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAssetDisplayUrl } from "@/lib/storage";
import { getContentAccess } from "@/lib/monetization";
import { recordPublicationView, isPublicationPubliclyVisible } from "@cinerra/domain";
import { Header } from "@/components/Header";
import { MobileNav } from "@/components/Nav";
import { FavoriteButton } from "@/components/FavoriteButton";
import { UnlockButton } from "@/components/monetization/UnlockButton";
import { WatchPlayer } from "@/components/watch/WatchPlayer";
import { Footer } from "@/components/Footer";

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

  if (!publication) notFound();

  const isOwner = userId === publication.project.ownerId;
  const publiclyVisible = isPublicationPubliclyVisible(publication);
  // Non-owners only ever see a moderation-approved publication — sharing a
  // direct link can't bypass the queue. The owner can still preview their
  // own pending/rejected submission here, with a status banner below.
  if (!isOwner && !publiclyVisible) notFound();

  // Only count real public views — not the owner previewing their own
  // pending/rejected submission before it's actually live.
  if (publiclyVisible) await recordPublicationView(publication.id);

  const project = publication.project;
  const isPaid = project.monetizationMode === "PAID";
  const scope = project.monetizationScope;

  // Movie-scope: one unlock covers every episode. Episode-scope: each
  // episode is checked and priced independently. Scene-scope has no
  // per-scene player yet (see schema.prisma's note on Scene.coinPrice),
  // so it isn't gated at this level — episodes stream as if free until
  // that capability exists.
  const movieAccess = isPaid && scope === "MOVIE" ? await getContentAccess(userId ?? null, "MOVIE", project.id) : null;

  const episodesWithVideo = await Promise.all(
    publication.project.episodes
      .filter((e) => e.exports[0]?.assetKey)
      .map(async (e) => {
        let locked = false;
        let price: number | null = null;
        let balance = 0;
        if (isPaid && scope === "MOVIE") {
          locked = !movieAccess!.unlocked;
          price = movieAccess!.price;
          balance = movieAccess!.balance;
        } else if (isPaid && scope === "EPISODE" && e.coinPrice != null) {
          const access = await getContentAccess(userId ?? null, "EPISODE", e.id);
          locked = !access.unlocked;
          price = access.price;
          balance = access.balance;
        }
        return {
          id: e.id,
          number: e.number,
          title: e.title,
          locked,
          price,
          balance,
          videoUrl: locked ? null : await getAssetDisplayUrl(e.exports[0]!.assetKey!),
        };
      }),
  );

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-4xl px-4 pb-24 pt-6 md:px-8">
        {isOwner && publication.moderationStatus !== "APPROVED" && (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
              publication.moderationStatus === "REJECTED"
                ? "border-red-500/30 bg-red-500/10 text-red-200"
                : "border-cinerra-gold/40 bg-cinerra-gold/10 text-cinerra-text"
            }`}
          >
            {publication.moderationStatus === "REJECTED" ? (
              <>
                This movie was rejected during review{publication.moderationNotes ? `: ${publication.moderationNotes}` : "."} Only
                you can see this page.
              </>
            ) : (
              <>This movie is pending review and isn&rsquo;t visible on Discover yet. Only you can see this page.</>
            )}
          </div>
        )}
        {episodesWithVideo.length === 0 ? (
          <p className="rounded-xl border border-cinerra-border bg-cinerra-surface p-6 text-sm text-cinerra-muted">
            This movie's video isn't available right now.
          </p>
        ) : episodesWithVideo[0]!.locked ? (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl border border-cinerra-border bg-cinerra-surface p-6 text-center">
            <p className="font-display text-lg font-semibold text-cinerra-text">
              {scope === "MOVIE" ? "Unlock this movie to watch" : "Unlock this episode to watch"}
            </p>
            {userId ? (
              <UnlockButton
                scope={scope === "MOVIE" ? "MOVIE" : "EPISODE"}
                contentId={scope === "MOVIE" ? project.id : episodesWithVideo[0]!.id}
                price={episodesWithVideo[0]!.price!}
                balance={episodesWithVideo[0]!.balance}
                label={scope === "MOVIE" ? "Unlock Movie" : "Unlock Episode"}
              />
            ) : (
              <Link href="/login" className="btn-primary-sm">
                Sign in to unlock — 🪙 {episodesWithVideo[0]!.price?.toLocaleString()}
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-cinerra-border bg-black shadow-card">
            <WatchPlayer
              key={episodesWithVideo[0]!.id}
              projectId={publication.project.id}
              episodeId={episodesWithVideo[0]!.id}
              videoUrl={episodesWithVideo[0]!.videoUrl!}
              className="aspect-video w-full bg-black"
            />
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-cinerra-text md:text-3xl">{publication.project.title}</h1>
            <p className="mt-1 text-sm text-cinerra-muted">
              By {publication.publishedBy.name ?? "A FilmDoe creator"} · {publication.views.toLocaleString()} views · {publication.saves.toLocaleString()} saves
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
              {episodesWithVideo.map((e) =>
                e.locked ? (
                  <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="text-cinerra-muted">
                      Ep {e.number} — {e.title}
                    </span>
                    {userId ? (
                      <UnlockButton scope="EPISODE" contentId={e.id} price={e.price!} balance={e.balance} label="Unlock" />
                    ) : (
                      <Link href="/login" className="btn-secondary-sm">
                        🪙 {e.price?.toLocaleString()} — Sign in
                      </Link>
                    )}
                  </div>
                ) : (
                  <a key={e.id} href={e.videoUrl!} target="_blank" rel="noreferrer" className="flex items-center justify-between px-4 py-3 text-sm hover:bg-cinerra-surface2/50">
                    <span>
                      Ep {e.number} — {e.title}
                    </span>
                    <span className="text-cinerra-muted">Watch →</span>
                  </a>
                ),
              )}
            </div>
          </div>
        )}
      </main>
      <Footer />
      <MobileNav />
    </div>
  );
}
