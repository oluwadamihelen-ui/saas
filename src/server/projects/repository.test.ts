import { describe, it, expect, afterEach } from "vitest";
import {
  createProjectForUser,
  getProjectForUser,
  listProjectsForUser,
  deleteProjectForUser,
  ProjectNotFoundError,
} from "./repository";
import { createTestUser, deleteTestUser } from "@/test/db-helpers";

describe("project repository ownership", () => {
  let ownerId: string | undefined;
  let attackerId: string | undefined;

  afterEach(async () => {
    if (ownerId) await deleteTestUser(ownerId);
    if (attackerId) await deleteTestUser(attackerId);
    ownerId = undefined;
    attackerId = undefined;
  });

  it("lets the owner read their own project", async () => {
    const owner = await createTestUser("owner");
    ownerId = owner.id;
    const project = await createProjectForUser(owner.id, { title: "My video" });

    const fetched = await getProjectForUser(owner.id, project.id);
    expect(fetched.id).toBe(project.id);
  });

  it("throws ProjectNotFoundError (not a generic error) when a different user requests the same project id", async () => {
    const owner = await createTestUser("owner");
    const attacker = await createTestUser("attacker");
    ownerId = owner.id;
    attackerId = attacker.id;

    const project = await createProjectForUser(owner.id, { title: "Private video" });

    await expect(getProjectForUser(attacker.id, project.id)).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it("excludes another user's projects from listProjectsForUser", async () => {
    const owner = await createTestUser("owner");
    const attacker = await createTestUser("attacker");
    ownerId = owner.id;
    attackerId = attacker.id;

    await createProjectForUser(owner.id, { title: "Owner's video" });

    const attackerProjects = await listProjectsForUser(attacker.id);
    expect(attackerProjects).toHaveLength(0);
  });

  it("does not allow a different user to delete a project (deleteMany scoped by userId)", async () => {
    const owner = await createTestUser("owner");
    const attacker = await createTestUser("attacker");
    ownerId = owner.id;
    attackerId = attacker.id;

    const project = await createProjectForUser(owner.id, { title: "Protected video" });

    await expect(deleteProjectForUser(attacker.id, project.id)).rejects.toBeInstanceOf(ProjectNotFoundError);

    // Still there, still readable by the real owner.
    const stillThere = await getProjectForUser(owner.id, project.id);
    expect(stillThere.id).toBe(project.id);
  });

  it("throws for a project id that doesn't exist at all", async () => {
    const owner = await createTestUser("owner");
    ownerId = owner.id;
    await expect(getProjectForUser(owner.id, "nonexistent-id")).rejects.toBeInstanceOf(ProjectNotFoundError);
  });
});
