import { prisma } from "@cinerra/database";

/** Normalizes a name for fuzzy matching: uppercase, letters/digits only. */
function normalize(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Reconciles the raw character names captured on each Scene (from the
 * Screenwriter agent, before any Character rows existed) against the real
 * Character Bible once it's generated — creating the relational
 * SceneCharacter links the continuity engine depends on, and assigning
 * each character's default wardrobe for that scene. Idempotent: safe to
 * re-run after regenerating characters.
 */
export async function linkSceneCharacters(projectId: string): Promise<void> {
  const [scenes, characters] = await Promise.all([
    prisma.scene.findMany({ where: { projectId }, select: { id: true, rawCharacterNames: true } }),
    prisma.character.findMany({ where: { projectId }, include: { wardrobes: { orderBy: { createdAt: "asc" }, take: 1 } } }),
  ]);

  const byNormalizedName = new Map(characters.map((c) => [normalize(c.name), c]));

  for (const scene of scenes) {
    for (const rawName of scene.rawCharacterNames) {
      const character = byNormalizedName.get(normalize(rawName));
      if (!character) continue;

      await prisma.sceneCharacter.upsert({
        where: { sceneId_characterId: { sceneId: scene.id, characterId: character.id } },
        create: { sceneId: scene.id, characterId: character.id, wardrobeId: character.wardrobes[0]?.id },
        update: { wardrobeId: character.wardrobes[0]?.id },
      });
    }
  }
}

/**
 * Same reconciliation for locations: matches Scene.rawLocationName against
 * real Location rows and sets Scene.locationId. Scene headings that
 * describe the same physical place should already have been merged by the
 * Location Designer agent into one Location row.
 */
export async function linkSceneLocations(projectId: string): Promise<void> {
  const [scenes, locations] = await Promise.all([
    prisma.scene.findMany({ where: { projectId, locationId: null }, select: { id: true, rawLocationName: true } }),
    prisma.location.findMany({ where: { projectId } }),
  ]);

  const byNormalizedName = new Map(locations.map((l) => [normalize(l.name), l]));

  for (const scene of scenes) {
    if (!scene.rawLocationName) continue;
    const normalized = normalize(scene.rawLocationName);

    // Exact match first, then a contains-match in either direction, so
    // "Cole House Kitchen" matches a raw heading like "COLE HOUSE - KITCHEN".
    let location = byNormalizedName.get(normalized);
    if (!location) {
      location = locations.find((l) => normalized.includes(normalize(l.name)) || normalize(l.name).includes(normalized));
    }
    if (!location) continue;

    await prisma.scene.update({ where: { id: scene.id }, data: { locationId: location.id } });
  }
}
