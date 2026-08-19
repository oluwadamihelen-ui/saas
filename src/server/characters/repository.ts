import { prisma } from "@/server/db/client";

export class CharacterNotFoundError extends Error {
  constructor() {
    super("Character not found");
    this.name = "CharacterNotFoundError";
  }
}

export async function listCharactersForUser(userId: string) {
  return prisma.character.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getCharacterForUser(userId: string, characterId: string) {
  const character = await prisma.character.findFirst({ where: { id: characterId, userId } });
  if (!character) throw new CharacterNotFoundError();
  return character;
}

export async function createCharacterForUser(
  userId: string,
  data: {
    name: string;
    ageCategory?: string;
    genderPresentation?: string;
    appearance?: string;
    hair?: string;
    clothing?: string;
    accessories?: string;
    personality?: string;
    referenceImageUrl?: string;
  }
) {
  return prisma.character.create({
    data: {
      userId,
      name: data.name,
      ageCategory: data.ageCategory,
      genderPresentation: data.genderPresentation,
      appearance: data.appearance,
      hair: data.hair,
      clothing: data.clothing,
      accessories: data.accessories,
      personality: data.personality,
      referenceImageUrl: data.referenceImageUrl,
      visualDescriptor: buildVisualDescriptor(data),
    },
  });
}

export async function updateCharacterForUser(
  userId: string,
  characterId: string,
  data: Partial<{
    name: string;
    ageCategory: string;
    genderPresentation: string;
    appearance: string;
    hair: string;
    clothing: string;
    accessories: string;
    personality: string;
    referenceImageUrl: string;
  }>
) {
  const existing = await getCharacterForUser(userId, characterId);
  const merged = { ...existing, ...data };

  return prisma.character.update({
    where: { id: characterId },
    data: { ...data, visualDescriptor: buildVisualDescriptor(merged) },
  });
}

export async function deleteCharacterForUser(userId: string, characterId: string) {
  const result = await prisma.character.deleteMany({ where: { id: characterId, userId } });
  if (result.count === 0) throw new CharacterNotFoundError();
}

export async function attachCharacterToProject(projectId: string, characterId: string) {
  await prisma.projectCharacter.upsert({
    where: { projectId_characterId: { projectId, characterId } },
    create: { projectId, characterId },
    update: {},
  });
}

/**
 * The canonical prompt fragment used everywhere this character appears, so
 * the same description feeds every scene's image generation call — this is
 * the mechanism behind character consistency across scenes.
 */
function buildVisualDescriptor(c: {
  name: string;
  ageCategory?: string | null;
  genderPresentation?: string | null;
  appearance?: string | null;
  hair?: string | null;
  clothing?: string | null;
  accessories?: string | null;
}): string {
  const parts = [
    c.ageCategory,
    c.genderPresentation,
    c.appearance,
    c.hair ? `hair: ${c.hair}` : null,
    c.clothing ? `wearing ${c.clothing}` : null,
    c.accessories ? `with ${c.accessories}` : null,
  ].filter(Boolean);

  return `${c.name}${parts.length ? " — " + parts.join(", ") : ""}`;
}
