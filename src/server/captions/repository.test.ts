import { describe, it, expect, afterEach } from "vitest";
import { addCaptionForUser, updateCaptionForUser, deleteCaptionForUser, listCaptionsForUser } from "./repository";
import { addSceneForUser } from "@/server/scenes/repository";
import { createProjectForUser } from "@/server/projects/repository";
import { createTestUser, deleteTestUser } from "@/test/db-helpers";

describe("caption repository ownership (via scene.project.userId)", () => {
  let ownerId: string | undefined;
  let attackerId: string | undefined;

  afterEach(async () => {
    if (ownerId) await deleteTestUser(ownerId);
    if (attackerId) await deleteTestUser(attackerId);
    ownerId = undefined;
    attackerId = undefined;
  });

  it("rejects listing captions on another user's scene", async () => {
    const owner = await createTestUser("owner");
    const attacker = await createTestUser("attacker");
    ownerId = owner.id;
    attackerId = attacker.id;

    const project = await createProjectForUser(owner.id, { title: "Owner project" });
    const scene = await addSceneForUser(owner.id, project.id);

    await expect(listCaptionsForUser(attacker.id, scene.id)).rejects.toThrow();
  });

  it("rejects adding a caption to another user's scene", async () => {
    const owner = await createTestUser("owner");
    const attacker = await createTestUser("attacker");
    ownerId = owner.id;
    attackerId = attacker.id;

    const project = await createProjectForUser(owner.id, { title: "Owner project" });
    const scene = await addSceneForUser(owner.id, project.id);

    await expect(
      addCaptionForUser(attacker.id, scene.id, { text: "hijacked caption", startMs: 0, endMs: 1000 })
    ).rejects.toThrow();
  });

  it("rejects updating and deleting a caption that belongs to another user's scene", async () => {
    const owner = await createTestUser("owner");
    const attacker = await createTestUser("attacker");
    ownerId = owner.id;
    attackerId = attacker.id;

    const project = await createProjectForUser(owner.id, { title: "Owner project" });
    const scene = await addSceneForUser(owner.id, project.id);
    const caption = await addCaptionForUser(owner.id, scene.id, { text: "original", startMs: 0, endMs: 1000 });

    await expect(updateCaptionForUser(attacker.id, caption.id, { text: "hijacked" })).rejects.toThrow();
    await expect(deleteCaptionForUser(attacker.id, caption.id)).rejects.toThrow();

    const captions = await listCaptionsForUser(owner.id, scene.id);
    expect(captions).toHaveLength(1);
    expect(captions[0].text).toBe("original");
  });

  it("orders newly added captions by insertion (order field increments)", async () => {
    const owner = await createTestUser("owner");
    ownerId = owner.id;

    const project = await createProjectForUser(owner.id, { title: "Owner project" });
    const scene = await addSceneForUser(owner.id, project.id);

    await addCaptionForUser(owner.id, scene.id, { text: "first", startMs: 0, endMs: 500 });
    await addCaptionForUser(owner.id, scene.id, { text: "second", startMs: 500, endMs: 1000 });

    const captions = await listCaptionsForUser(owner.id, scene.id);
    expect(captions.map((c) => c.text)).toEqual(["first", "second"]);
    expect(captions.map((c) => c.order)).toEqual([0, 1]);
  });
});
