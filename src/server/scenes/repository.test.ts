import { describe, it, expect, afterEach } from "vitest";
import {
  addSceneForUser,
  getSceneForUser,
  updateSceneForUser,
  deleteSceneForUser,
  duplicateSceneForUser,
  moveSceneForUser,
  SceneNotFoundError,
} from "./repository";
import { createProjectForUser } from "@/server/projects/repository";
import { createTestUser, deleteTestUser } from "@/test/db-helpers";

describe("scene repository ownership (via project.userId)", () => {
  let ownerId: string | undefined;
  let attackerId: string | undefined;

  afterEach(async () => {
    if (ownerId) await deleteTestUser(ownerId);
    if (attackerId) await deleteTestUser(attackerId);
    ownerId = undefined;
    attackerId = undefined;
  });

  it("rejects a cross-user scene read even with a valid scene id", async () => {
    const owner = await createTestUser("owner");
    const attacker = await createTestUser("attacker");
    ownerId = owner.id;
    attackerId = attacker.id;

    const project = await createProjectForUser(owner.id, { title: "Owner project" });
    const scene = await addSceneForUser(owner.id, project.id);

    await expect(getSceneForUser(attacker.id, scene.id)).rejects.toBeInstanceOf(SceneNotFoundError);
  });

  it("rejects adding a scene to another user's project", async () => {
    const owner = await createTestUser("owner");
    const attacker = await createTestUser("attacker");
    ownerId = owner.id;
    attackerId = attacker.id;

    const project = await createProjectForUser(owner.id, { title: "Owner project" });

    await expect(addSceneForUser(attacker.id, project.id)).rejects.toBeInstanceOf(SceneNotFoundError);
  });

  it("rejects a cross-user scene update and delete", async () => {
    const owner = await createTestUser("owner");
    const attacker = await createTestUser("attacker");
    ownerId = owner.id;
    attackerId = attacker.id;

    const project = await createProjectForUser(owner.id, { title: "Owner project" });
    const scene = await addSceneForUser(owner.id, project.id);

    await expect(updateSceneForUser(attacker.id, scene.id, { title: "Hijacked" })).rejects.toBeInstanceOf(
      SceneNotFoundError
    );
    await expect(deleteSceneForUser(attacker.id, scene.id)).rejects.toBeInstanceOf(SceneNotFoundError);
    await expect(duplicateSceneForUser(attacker.id, scene.id)).rejects.toBeInstanceOf(SceneNotFoundError);
    await expect(moveSceneForUser(attacker.id, scene.id, "up")).rejects.toBeInstanceOf(SceneNotFoundError);

    const stillThere = await getSceneForUser(owner.id, scene.id);
    expect(stillThere.title).not.toBe("Hijacked");
  });

  it("re-packs scene order to stay contiguous after a delete", async () => {
    const owner = await createTestUser("owner");
    ownerId = owner.id;

    const project = await createProjectForUser(owner.id, { title: "Reorder test" });
    const s1 = await addSceneForUser(owner.id, project.id);
    const s2 = await addSceneForUser(owner.id, project.id);
    const s3 = await addSceneForUser(owner.id, project.id);

    await deleteSceneForUser(owner.id, s2.id);

    const remaining1 = await getSceneForUser(owner.id, s1.id);
    const remaining3 = await getSceneForUser(owner.id, s3.id);
    expect(remaining1.order).toBe(0);
    expect(remaining3.order).toBe(1);
  });
});
