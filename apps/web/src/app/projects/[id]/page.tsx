import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/Header";
import { MobileNav } from "@/components/Nav";
import { GenerationProgress, type GenerationKind } from "@/components/GenerationProgress";
import { GenerateScriptButton } from "@/components/create/GenerateScriptButton";
import { GenerateBibleButton } from "@/components/create/GenerateBibleButton";
import { CharacterCard } from "@/components/CharacterCard";
import { LocationCard } from "@/components/LocationCard";
import { ShotCard } from "@/components/ShotCard";

const JOB_TITLES: Record<GenerationKind, string> = {
  story: "Creating story outline…",
  script: "Writing your screenplay…",
  characters: "Building your character bible…",
  locations: "Building your location bible…",
  storyboard: "Building your storyboard…",
};

const VALID_KINDS = new Set<GenerationKind>(["story", "script", "characters", "locations", "storyboard"]);

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { job?: string; kind?: string };
}) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      storyBible: true,
      episodes: { orderBy: { number: "asc" } },
      characters: { orderBy: { code: "asc" } },
      locations: { orderBy: { code: "asc" } },
      scenes: {
        orderBy: { number: "asc" },
        include: {
          location: true,
          shots: { orderBy: { order: "asc" }, include: { characters: { include: { character: true } } } },
        },
      },
    },
  });
  if (!project) notFound();
  if (project.ownerId !== userId) notFound();

  const requestedKind = searchParams.kind as GenerationKind | undefined;
  const activeJobKind: GenerationKind = requestedKind && VALID_KINDS.has(requestedKind) ? requestedKind : "story";
  const episodeStructure = (project.storyBible?.episodeStructure as Array<{ number: number; title: string; synopsis: string }> | null) ?? [];
  const hasScript = project.episodes.some((e) => e.script);
  const hasShots = project.scenes.some((s) => s.shots.length > 0);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-8 md:px-8">
        <h1 className="font-display text-2xl font-bold md:text-3xl">{project.title}</h1>
        <p className="mt-1 text-sm text-cinerra-muted">
          {project.format.replace(/_/g, " ")} · {project.aspectRatio.replace(/_/g, " ")} · {project.visualStyle.replace(/_/g, " ")}
        </p>

        {searchParams.job && (
          <div className="mt-6">
            <GenerationProgress jobId={searchParams.job} kind={activeJobKind} title={JOB_TITLES[activeJobKind] ?? "Generating…"} />
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
          <section className="mt-8">
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

        {hasScript && (
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Characters</h2>
              <GenerateBibleButton
                projectId={project.id}
                endpoint={`/api/projects/${project.id}/characters/generate`}
                kind="characters"
                label={project.characters.length > 0 ? "Regenerate Characters" : "Generate Characters"}
              />
            </div>
            {project.characters.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {project.characters.map((c) => (
                  <CharacterCard
                    key={c.id}
                    id={c.id}
                    code={c.code}
                    name={c.name}
                    age={c.age}
                    face={c.face}
                    hair={c.hair}
                    eyes={c.eyes}
                    personality={c.personality}
                    voiceProfile={c.voiceProfile}
                    isLocked={c.isLocked}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-cinerra-muted">No characters yet — the Character Designer reads your screenplay.</p>
            )}
          </section>
        )}

        {hasScript && (
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Locations</h2>
              <GenerateBibleButton
                projectId={project.id}
                endpoint={`/api/projects/${project.id}/locations/generate`}
                kind="locations"
                label={project.locations.length > 0 ? "Regenerate Locations" : "Generate Locations"}
              />
            </div>
            {project.locations.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {project.locations.map((l) => (
                  <LocationCard
                    key={l.id}
                    id={l.id}
                    code={l.code}
                    name={l.name}
                    architecture={l.architecture}
                    lighting={l.lighting}
                    colorPalette={l.colorPalette}
                    isLocked={l.isLocked}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-cinerra-muted">No locations yet — the Location Designer reads your screenplay.</p>
            )}
          </section>
        )}

        {project.characters.length > 0 && project.locations.length > 0 && (
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Storyboard</h2>
              <GenerateBibleButton
                projectId={project.id}
                endpoint={`/api/projects/${project.id}/storyboard/generate`}
                kind="storyboard"
                label={hasShots ? "Generate Remaining Shots" : "Generate Storyboard"}
              />
            </div>
            {hasShots ? (
              <div className="flex flex-col gap-6">
                {project.scenes
                  .filter((s) => s.shots.length > 0)
                  .map((scene) => (
                    <div key={scene.id}>
                      <p className="mb-2 text-xs uppercase tracking-wide text-cinerra-muted">
                        Scene {scene.number} · {scene.intExt} {scene.location?.name ?? scene.rawLocationName ?? ""}
                      </p>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {scene.shots.map((shot) => (
                          <ShotCard
                            key={shot.id}
                            code={shot.code}
                            shotType={shot.shotType}
                            durationSeconds={shot.durationSeconds}
                            action={shot.action}
                            dialogue={shot.dialogue}
                            characterNames={shot.characters.map((link) => link.character.name)}
                            status={shot.status}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-cinerra-muted">No shots yet — the Director agent breaks each scene into cinematic coverage.</p>
            )}
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
