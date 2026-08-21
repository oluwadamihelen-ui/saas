import { prisma } from "@cinerra/database";
import type { CompiledPromptContext } from "./promptCompiler.js";

/**
 * The Visual Continuity Engine (spec §20-21). Before any shot is
 * generated, this assembles exactly the character/location/wardrobe/prop
 * references and previous-shot state the prompt compiler needs — walking
 * the real foreign-key graph (never a flat JSON blob) so continuity can't
 * silently drift.
 */

export interface AssetUrlResolver {
  (storageKey: string): Promise<string>;
}

export async function resolveShotPromptContext(shotId: string): Promise<CompiledPromptContext> {
  const shot = await prisma.shot.findUniqueOrThrow({
    where: { id: shotId },
    include: {
      previousShot: true,
      characters: {
        include: {
          character: { include: { primaryReference: { include: { asset: true } } } },
        },
      },
      wardrobes: { include: { wardrobe: true } },
      props: { include: { prop: true } },
      scene: {
        include: {
          location: true,
          project: { include: { storyBible: true } },
        },
      },
    },
  });

  const project = shot.scene.project;
  const storyBible = project.storyBible;
  if (!storyBible) {
    throw new Error("This project has no Story Bible yet — generate the story before compiling shot prompts.");
  }

  const wardrobeByCharacterId = new Map(shot.wardrobes.map((link) => [link.wardrobe.characterId, link.wardrobe]));

  const characters = await Promise.all(
    shot.characters.map(async (link) => {
      const character = link.character;
      const wardrobe = wardrobeByCharacterId.get(character.id);
      const faceDescription = [character.face, character.hair, character.eyes, character.skin].filter(Boolean).join(", ") || undefined;
      return {
        name: character.name,
        code: character.code,
        faceDescription,
        continuityRules: character.continuityRules ?? undefined,
        isLocked: character.isLocked,
        wardrobeDescription: wardrobe ? [wardrobe.clothing, wardrobe.colors, wardrobe.accessories].filter(Boolean).join(", ") : undefined,
        wardrobeLocked: wardrobe?.isLocked,
      };
    }),
  );

  const props = shot.props.map((link) => ({
    name: link.prop.name,
    code: link.prop.code,
    description: link.prop.description ?? undefined,
    continuityNotes: link.prop.continuityNotes ?? undefined,
    isLocked: link.prop.isLocked,
  }));

  const location = shot.scene.location;

  const context: CompiledPromptContext = {
    visualStyle: formatVisualStyle(project.visualStyle, project.customStyle),
    aspectRatio: formatAspectRatio(project.aspectRatio),
    storyBible: {
      logline: storyBible.logline,
      tones: storyBible.tones,
      world: storyBible.world ?? undefined,
    },
    scene: {
      intExt: shot.scene.intExt,
      locationName: location?.name ?? "Unspecified location",
      locationDescription: location ? [location.architecture, location.lighting, location.colorPalette].filter(Boolean).join(", ") : undefined,
      timeOfDay: shot.scene.timeOfDay ?? undefined,
      locationLocked: location?.isLocked ?? false,
    },
    shot: {
      code: shot.code,
      shotType: shot.shotType,
      cameraMovement: shot.cameraMovement,
      lens: shot.lens ?? undefined,
      framing: shot.framing ?? undefined,
      eyeLine: shot.eyeLine ?? undefined,
      emotion: shot.emotion ?? undefined,
      action: shot.action ?? undefined,
      dialogue: shot.dialogue ?? undefined,
      durationSeconds: shot.durationSeconds,
    },
    characters,
    props,
    previousShot: shot.previousShot
      ? { code: shot.previousShot.code, emotion: shot.previousShot.emotion ?? undefined, action: shot.previousShot.action ?? undefined }
      : undefined,
  };

  return context;
}

export function formatVisualStyle(style: string, custom: string | null): string {
  if (style === "CUSTOM" && custom) return custom;
  return style
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatAspectRatio(ratio: string): "16:9" | "9:16" | "1:1" {
  switch (ratio) {
    case "LANDSCAPE_16_9":
      return "16:9";
    case "SQUARE_1_1":
      return "1:1";
    default:
      return "9:16";
  }
}

/** Reference images to attach to the provider call, in priority order. */
export async function resolveShotReferenceImages(shotId: string, resolveAssetUrl: AssetUrlResolver): Promise<Array<{ url: string; label: string }>> {
  const shot = await prisma.shot.findUniqueOrThrow({
    where: { id: shotId },
    include: {
      characters: { include: { character: { include: { primaryReference: { include: { asset: true } } } } } },
      scene: { include: { location: { include: { primaryReference: { include: { asset: true } } } } } },
    },
  });

  const refs: Array<{ url: string; label: string }> = [];
  for (const link of shot.characters) {
    const asset = link.character.primaryReference?.asset;
    if (asset) refs.push({ url: await resolveAssetUrl(asset.storageKey), label: `character:${link.character.code}` });
  }
  const locationAsset = shot.scene.location?.primaryReference?.asset;
  if (locationAsset) refs.push({ url: await resolveAssetUrl(locationAsset.storageKey), label: `location:${shot.scene.location?.code}` });

  return refs;
}
