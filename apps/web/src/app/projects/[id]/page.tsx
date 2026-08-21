import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/Header";
import { MobileNav } from "@/components/Nav";
import { GenerationProgress } from "@/components/GenerationProgress";
import { GenerateScriptButton } from "@/components/create/GenerateScriptButton";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { job?: string; kind?: "story" | "script" };
}) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      storyBible: true,
      episodes: { orderBy: { number: "asc" } },
    },
  });
  if (!project) notFound();
  if (project.ownerId !== userId) notFound();

  const activeJobKind = searchParams.kind ?? "story";
  const episodeStructure = (project.storyBible?.episodeStructure as Array<{ number: number; title: string; synopsis: string }> | null) ?? [];

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-8 md:px-8">
        <h1 className="font-display text-2xl font-bold md:text-3xl">{project.title}</h1>
        <p className="mt-1 text-sm text-cinerra-muted">
          {project.format.replace(/_/g, " ")} · {project.aspectRatio.replace(/_/g, " ")} · {project.visualStyle.replace(/_/g, " ")}
        </p>

        {searchParams.job && (
          <div className="mt-6">
            <GenerationProgress
              jobId={searchParams.job}
              kind={activeJobKind}
              title={activeJobKind === "story" ? "Creating story outline…" : "Writing your screenplay…"}
            />
          </div>
        )}

        {project.storyBible?.status === "READY" && (
          <section className="card mt-6">
            <h2 className="text-lg font-semibold">Story Bible</h2>
            <p className="mt-2 text-sm italic text-cinerra-muted">&ldquo;{project.storyBible.logline}&rdquo;</p>
            <p className="mt-3 text-sm text-cinerra-text">{project.storyBible.premise}</p>
            {project.storyBible.theme && (
              <p className="mt-3 text-sm text-cinerra-muted">
                <span className="font-medium text-cinerra-text">Theme:</span> {project.storyBible.theme}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {project.storyBible.genres.map((g) => (
                <span key={g} className="rounded-full border border-cinerra-border px-2.5 py-0.5 text-[11px] text-cinerra-muted">
                  {g}
                </span>
              ))}
            </div>
          </section>
        )}

        {episodeStructure.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 text-lg font-semibold">Episodes</h2>
            <div className="flex flex-col gap-3">
              {project.episodes.map((episode) => (
                <div key={episode.id} className="card flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">
                      Episode {episode.number}: {episode.title}
                    </p>
                    <p className="mt-1 text-xs text-cinerra-muted">{episode.synopsis}</p>
                    <p className="mt-2 text-[11px] uppercase tracking-wide text-cinerra-muted">{episode.status}</p>
                  </div>
                  {episode.status === "DRAFT" && !episode.script && <GenerateScriptButton projectId={project.id} episodeId={episode.id} />}
                  {episode.script && <span className="text-xs text-cinerra-accent">Script ready</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        {!project.storyBible && !searchParams.job && (
          <p className="mt-6 text-sm text-cinerra-muted">This project doesn&apos;t have a story yet.</p>
        )}
      </main>
      <MobileNav />
    </div>
  );
}
