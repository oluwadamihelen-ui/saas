import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/server/db/client";
import { createTestUser, deleteTestUser } from "@/test/db-helpers";
import { runGenerateCaptions } from "./generate-captions";

async function makeScene(userId: string, narration: string | null) {
  const project = await prisma.project.create({ data: { userId, title: "Caption timing test" } });
  const scene = await prisma.scene.create({
    data: { projectId: project.id, order: 0, title: "Scene 1", narration: narration ?? undefined, durationSeconds: 6 },
  });
  return scene;
}

describe("runGenerateCaptions", () => {
  let userId: string | undefined;

  afterEach(async () => {
    if (userId) await deleteTestUser(userId);
    userId = undefined;
  });

  it("splits narration into caption chunks that span the full scene duration", async () => {
    const user = await createTestUser("captions");
    userId = user.id;
    const scene = await makeScene(
      user.id,
      "The brave fox ran across the meadow chasing the last rays of the setting sun before it vanished."
    );

    const captions = await runGenerateCaptions(scene.id, 10);

    expect(captions.length).toBeGreaterThan(0);
    expect(captions[0].startMs).toBe(0);
    expect(captions[captions.length - 1].endMs).toBe(10_000);
  });

  it("keeps captions contiguous and non-overlapping in order", async () => {
    const user = await createTestUser("captions");
    userId = user.id;
    const scene = await makeScene(
      user.id,
      "One two three four five six seven eight nine ten eleven twelve thirteen fourteen"
    );

    const captions = await runGenerateCaptions(scene.id, 8);

    for (let i = 1; i < captions.length; i++) {
      expect(captions[i].order).toBe(i);
      expect(captions[i].startMs).toBe(captions[i - 1].endMs);
    }
  });

  it("returns no captions and clears existing ones for empty narration", async () => {
    const user = await createTestUser("captions");
    userId = user.id;
    const scene = await makeScene(user.id, "   ");

    const captions = await runGenerateCaptions(scene.id, 6);

    expect(captions).toEqual([]);
    const stored = await prisma.caption.findMany({ where: { sceneId: scene.id } });
    expect(stored).toHaveLength(0);
  });

  it("replaces any previously generated captions rather than appending", async () => {
    const user = await createTestUser("captions");
    userId = user.id;
    const scene = await makeScene(user.id, "First pass narration text here for the scene");

    await runGenerateCaptions(scene.id, 5);
    const second = await runGenerateCaptions(scene.id, 5);

    const stored = await prisma.caption.findMany({ where: { sceneId: scene.id } });
    expect(stored).toHaveLength(second.length);
  });

  it("enforces a minimum total duration of 1 second even for a near-zero duration", async () => {
    const user = await createTestUser("captions");
    userId = user.id;
    const scene = await makeScene(user.id, "One word");

    const captions = await runGenerateCaptions(scene.id, 0);

    expect(captions[captions.length - 1].endMs).toBe(1000);
  });
});
