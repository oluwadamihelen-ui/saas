import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { requireAcceptedTerms } from "@/lib/authGuards";
import { getEpisodeTimeline } from "@cinerra/domain";
import { Header } from "@/components/Header";
import { MobileNav } from "@/components/Nav";
import { TimelineEditor } from "@/components/TimelineEditor";

export default async function TimelinePage({ params }: { params: { id: string; episodeId: string } }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");
  requireAcceptedTerms(session, `/projects/${params.id}/episodes/${params.episodeId}/timeline`);

  const timeline = await getEpisodeTimeline({ userId, episodeId: params.episodeId }).catch(() => null);
  if (!timeline) notFound();

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-8 md:px-8">
        <Link href={`/projects/${params.id}`} className="text-sm text-cinerra-muted hover:text-cinerra-text">
          ← Back to project
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold md:text-3xl">Timeline — {timeline.episodeTitle}</h1>
        <p className="mt-1 max-w-xl text-sm text-cinerra-muted">
          Drag shots to reorder the cut. Adjust dialogue, sound effect, and score volume or mute a track — changes apply the
          next time you export this episode.
        </p>

        {timeline.shots.length === 0 ? (
          <p className="mt-8 rounded-xl border border-dashed border-cinerra-border py-16 text-center text-sm text-cinerra-muted">
            This episode has no generated shots yet.
          </p>
        ) : (
          <div className="mt-8">
            <TimelineEditor projectId={params.id} episodeId={params.episodeId} initialShots={timeline.shots} initialMusic={timeline.music} />
          </div>
        )}
      </main>
      <MobileNav />
    </div>
  );
}
