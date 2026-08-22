import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAssetDisplayUrl } from "@/lib/storage";
import { providerRegistry } from "@/lib/ai";
import { Header } from "@/components/Header";
import { MobileNav } from "@/components/Nav";
import { GenerationProgress, type GenerationKind } from "@/components/GenerationProgress";
import { GenerateScriptButton } from "@/components/create/GenerateScriptButton";
import { GenerateExportButton } from "@/components/create/GenerateExportButton";
import { GenerateMusicButton } from "@/components/create/GenerateMusicButton";
import { GenerateBibleButton } from "@/components/create/GenerateBibleButton";
import { CharacterCard } from "@/components/CharacterCard";
import { LocationCard } from "@/components/LocationCard";
import { PropCard } from "@/components/PropCard";
import { ShotCard } from "@/components/ShotCard";

const JOB_TITLES: Record<GenerationKind, string> = {
  story: "Creating story outline…",
  script: "Writing your screenplay…",
  characters: "Building your character bible…",
  locations: "Building your location bible…",
  props: "Building your prop bible…",
  storyboard: "Building your storyboard…",
  reference: "Generating reference image…",
  shot: "Generating shot…",
  dialogue: "Generating dialogue audio…",
  soundEffect: "Generating sound effect…",
  music: "Composing episode score…",
  export: "Assembling and exporting your episode…",
};

const VALID_KINDS = new Set<GenerationKind>([
  "story",
  "script",
  "characters",
  "locations",
  "props",
  "storyboard",
  "reference",
  "shot",
  "dialogue",
  "soundEffect",
  "music",
  "export",
]);

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
      episodes: {
        orderBy: { number: "asc" },
        include: {
          exports: { orderBy: { createdAt: "desc" }, take: 1 },
          timelineItems: { where: { track: "MUSIC" }, include: { audioItem: { include: { asset: true } } } },
        },
      },
      characters: {
        orderBy: { code: "asc" },
        include: { primaryReference: { include: { asset: true } }, wardrobes: { orderBy: { createdAt: "asc" }, include: { referenceAsset: true } } },
      },
      locations: { orderBy: { code: "asc" }, include: { primaryReference: { include: { asset: true } } } },
      props: { orderBy: { code: "asc" }, include: { referenceAsset: true, ownerCharacter: true } },
      scenes: {
        orderBy: { number: "asc" },
        include: {
          location: true,
          shots: {
            orderBy: { order: "asc" },
            include: {
              characters: { include: { character: true } },
              videoAsset: true,
              timelineItems: { where: { track: { in: ["DIALOGUE", "SFX"] } }, include: { audioItem: { include: { asset: true } } } },
            },
          },
        },
      },
    },
  });
  if (!project) notFound();
  if (project.ownerId !== userId) notFound();

  const imageProviderConfigured = providerRegistry.isConfigured("IMAGE");
  const videoProviderConfigured = providerRegistry.isConfigured("VIDEO");
  const voiceProviderConfigured = providerRegistry.isConfigured("VOICE");
  const soundEffectProviderConfigured = providerRegistry.isConfigured("SOUND_EFFECT");
  const musicProviderConfigured = providerRegistry.isConfigured("MUSIC");

  const characterCards = await Promise.all(
    project.characters.map(async (c) => ({
      ...c,
      primaryReferenceResolved: c.primaryReference
        ? { id: c.primaryReference.id, imageUrl: await getAssetDisplayUrl(c.primaryReference.asset.storageKey), approvedAt: c.primaryReference.approvedAt }
        : null,
      wardrobesResolved: await Promise.all(
        c.wardrobes.map(async (w) => ({
          id: w.id,
          code: w.code,
          name: w.name,
          clothing: w.clothing,
          isLocked: w.isLocked,
          referenceImageUrl: w.referenceAsset ? await getAssetDisplayUrl(w.referenceAsset.storageKey) : null,
        })),
      ),
    })),
  );

  const locationCards = await Promise.all(
    project.locations.map(async (l) => ({
      ...l,
      primaryReferenceResolved: l.primaryReference
        ? { id: l.primaryReference.id, imageUrl: await getAssetDisplayUrl(l.primaryReference.asset.storageKey), approvedAt: l.primaryReference.approvedAt }
        : null,
    })),
  );

  const propCards = await Promise.all(
    project.props.map(async (p) => ({
      ...p,
      referenceImageUrl: p.referenceAsset ? await getAssetDisplayUrl(p.referenceAsset.storageKey) : null,
    })),
  );

  const scenesWithShotUrls = await Promise.all(
    project.scenes
      .filter((s) => s.shots.length > 0)
      .map(async (scene) => ({
        ...scene,
        shotsResolved: await Promise.all(
          scene.shots.map(async (shot) => {
            const dialogueAsset = shot.timelineItems.find((t) => t.track === "DIALOGUE")?.audioItem?.asset;
            const sfxAsset = shot.timelineItems.find((t) => t.track === "SFX")?.audioItem?.asset;
            return {
              ...shot,
              videoUrl: shot.videoAsset ? await getAssetDisplayUrl(shot.videoAsset.storageKey) : null,
              dialogueAudioUrl: dialogueAsset ? await getAssetDisplayUrl(dialogueAsset.storageKey) : null,
              sfxAudioUrl: sfxAsset ? await getAssetDisplayUrl(sfxAsset.storageKey) : null,
            };
          }),
        ),
      })),
  );

  const episodeCards = await Promise.all(
    project.episodes.map(async (episode) => {
      const episodeShots = project.scenes.filter((s) => s.episodeId === episode.id).flatMap((s) => s.shots);
      const latestExport = episode.exports[0] ?? null;
      const musicAsset = episode.timelineItems[0]?.audioItem?.asset;
      return {
        ...episode,
        allShotsReady: episodeShots.length > 0 && episodeShots.every((s) => s.status === "READY"),
        latestExport: latestExport
          ? { ...latestExport, downloadUrl: latestExport.assetKey ? await getAssetDisplayUrl(latestExport.assetKey) : null }
          : null,
        musicUrl: musicAsset ? await getAssetDisplayUrl(musicAsset.storageKey) : null,
      };
    }),
  );

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
              {episodeCards.map((episode) => (
                <div key={episode.id} className="card flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">
                      Episode {episode.number}: {episode.title}
                    </p>
                    <p className="mt-1 text-xs text-cinerra-muted">{episode.synopsis}</p>
                    <p className="mt-2 text-[11px] uppercase tracking-wide text-cinerra-muted">{episode.status}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {episode.status === "DRAFT" && !episode.script && <GenerateScriptButton projectId={project.id} episodeId={episode.id} />}
                    {episode.script && !episode.allShotsReady && <span className="text-xs text-cinerra-accent">Script ready</span>}
                    {episode.allShotsReady && episode.latestExport?.status !== "SUCCEEDED" && (
                      <GenerateExportButton
                        projectId={project.id}
                        episodeId={episode.id}
                        label={episode.latestExport?.status === "FAILED" ? "Retry Export" : "Export Episode"}
                      />
                    )}
                    {episode.latestExport?.status === "SUCCEEDED" && episode.latestExport.downloadUrl && (
                      <a
                        href={episode.latestExport.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full bg-cinerra-accent px-4 py-1.5 text-xs font-medium text-white hover:brightness-110"
                      >
                        Download ({episode.latestExport.resolution})
                      </a>
                    )}
                    {episode.latestExport?.status === "FAILED" && (
                      <p className="max-w-[16rem] text-right text-[11px] text-red-300">{episode.latestExport.errorMessage}</p>
                    )}
                    {episode.script && (
                      <div className="mt-1 w-full max-w-[16rem]">
                        {episode.musicUrl ? (
                          // eslint-disable-next-line jsx-a11y/media-has-caption
                          <audio src={episode.musicUrl} controls className="h-8 w-full" />
                        ) : musicProviderConfigured ? (
                          <GenerateMusicButton projectId={project.id} episodeId={episode.id} />
                        ) : (
                          <p className="text-right text-[11px] text-cinerra-muted">Music generation provider not configured.</p>
                        )}
                      </div>
                    )}
                  </div>
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
            {characterCards.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {characterCards.map((c) => (
                  <CharacterCard
                    key={c.id}
                    id={c.id}
                    projectId={project.id}
                    code={c.code}
                    name={c.name}
                    age={c.age}
                    face={c.face}
                    hair={c.hair}
                    eyes={c.eyes}
                    personality={c.personality}
                    voiceProfile={c.voiceProfile}
                    isLocked={c.isLocked}
                    primaryReference={c.primaryReferenceResolved}
                    imageProviderConfigured={imageProviderConfigured}
                    wardrobes={c.wardrobesResolved}
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
            {locationCards.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {locationCards.map((l) => (
                  <LocationCard
                    key={l.id}
                    id={l.id}
                    projectId={project.id}
                    code={l.code}
                    name={l.name}
                    architecture={l.architecture}
                    lighting={l.lighting}
                    colorPalette={l.colorPalette}
                    isLocked={l.isLocked}
                    primaryReference={l.primaryReferenceResolved}
                    imageProviderConfigured={imageProviderConfigured}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-cinerra-muted">No locations yet — the Location Designer reads your screenplay.</p>
            )}
          </section>
        )}

        {hasScript && (
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Props</h2>
              <GenerateBibleButton
                projectId={project.id}
                endpoint={`/api/projects/${project.id}/props/generate`}
                kind="props"
                label={project.props.length > 0 ? "Regenerate Props" : "Generate Props"}
              />
            </div>
            {propCards.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {propCards.map((p) => (
                  <PropCard
                    key={p.id}
                    id={p.id}
                    projectId={project.id}
                    code={p.code}
                    name={p.name}
                    description={p.description}
                    continuityNotes={p.continuityNotes}
                    ownerCharacterName={p.ownerCharacter?.name ?? null}
                    isLocked={p.isLocked}
                    referenceImageUrl={p.referenceImageUrl}
                    imageProviderConfigured={imageProviderConfigured}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-cinerra-muted">No props yet — the Prop Designer reads your screenplay for significant, recurring props.</p>
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
            {scenesWithShotUrls.length > 0 ? (
              <div className="flex flex-col gap-6">
                {scenesWithShotUrls.map((scene) => (
                  <div key={scene.id}>
                    <p className="mb-2 text-xs uppercase tracking-wide text-cinerra-muted">
                      Scene {scene.number} · {scene.intExt} {scene.location?.name ?? scene.rawLocationName ?? ""}
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {scene.shotsResolved.map((shot) => (
                        <ShotCard
                          key={shot.id}
                          id={shot.id}
                          projectId={project.id}
                          code={shot.code}
                          shotType={shot.shotType}
                          durationSeconds={shot.durationSeconds}
                          action={shot.action}
                          dialogue={shot.dialogue}
                          characterNames={shot.characters.map((link) => link.character.name)}
                          status={shot.status}
                          videoUrl={shot.videoUrl}
                          videoProviderConfigured={videoProviderConfigured}
                          dialogueAudioUrl={shot.dialogueAudioUrl}
                          voiceProviderConfigured={voiceProviderConfigured}
                          sfxAudioUrl={shot.sfxAudioUrl}
                          soundEffectProviderConfigured={soundEffectProviderConfigured}
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
