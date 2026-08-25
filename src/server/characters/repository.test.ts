import { describe, it, expect, afterEach } from "vitest";
import {
  createCharacterForUser,
  getCharacterForUser,
  updateCharacterForUser,
  deleteCharacterForUser,
  listCharactersForUser,
  CharacterNotFoundError,
} from "./repository";
import { createTestUser, deleteTestUser } from "@/test/db-helpers";

describe("character repository ownership", () => {
  let ownerId: string | undefined;
  let attackerId: string | undefined;

  afterEach(async () => {
    if (ownerId) await deleteTestUser(ownerId);
    if (attackerId) await deleteTestUser(attackerId);
    ownerId = undefined;
    attackerId = undefined;
  });

  it("builds a visualDescriptor from the provided traits for character consistency", async () => {
    const owner = await createTestUser("owner");
    ownerId = owner.id;

    const character = await createCharacterForUser(owner.id, {
      name: "Milo",
      appearance: "short and round",
      hair: "curly orange",
      clothing: "a striped scarf",
    });

    expect(character.visualDescriptor).toContain("Milo");
    expect(character.visualDescriptor).toContain("short and round");
    expect(character.visualDescriptor).toContain("hair: curly orange");
    expect(character.visualDescriptor).toContain("wearing a striped scarf");
  });

  it("rejects a cross-user read with CharacterNotFoundError", async () => {
    const owner = await createTestUser("owner");
    const attacker = await createTestUser("attacker");
    ownerId = owner.id;
    attackerId = attacker.id;

    const character = await createCharacterForUser(owner.id, { name: "Private Pete" });

    await expect(getCharacterForUser(attacker.id, character.id)).rejects.toBeInstanceOf(CharacterNotFoundError);
  });

  it("rejects a cross-user update", async () => {
    const owner = await createTestUser("owner");
    const attacker = await createTestUser("attacker");
    ownerId = owner.id;
    attackerId = attacker.id;

    const character = await createCharacterForUser(owner.id, { name: "Original Name" });

    await expect(
      updateCharacterForUser(attacker.id, character.id, { name: "Hijacked Name" })
    ).rejects.toBeInstanceOf(CharacterNotFoundError);

    const unchanged = await getCharacterForUser(owner.id, character.id);
    expect(unchanged.name).toBe("Original Name");
  });

  it("rejects a cross-user delete and leaves the character intact", async () => {
    const owner = await createTestUser("owner");
    const attacker = await createTestUser("attacker");
    ownerId = owner.id;
    attackerId = attacker.id;

    const character = await createCharacterForUser(owner.id, { name: "Survivor" });

    await expect(deleteCharacterForUser(attacker.id, character.id)).rejects.toBeInstanceOf(CharacterNotFoundError);

    const stillThere = await getCharacterForUser(owner.id, character.id);
    expect(stillThere.id).toBe(character.id);
  });

  it("excludes another user's characters from listCharactersForUser", async () => {
    const owner = await createTestUser("owner");
    const attacker = await createTestUser("attacker");
    ownerId = owner.id;
    attackerId = attacker.id;

    await createCharacterForUser(owner.id, { name: "Owner's character" });

    expect(await listCharactersForUser(attacker.id)).toHaveLength(0);
  });
});
