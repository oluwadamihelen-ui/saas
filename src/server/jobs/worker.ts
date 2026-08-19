import "dotenv/config";
import { Worker } from "bullmq";
import {
  getRedisConnection,
  getSceneImageQueue,
  type ProjectGenerateJobData,
  type SceneImageJobData,
} from "./queue";
import { runProjectGeneration, markProjectReadyIfComplete } from "@/server/pipeline/orchestrator";
import { runGenerateSceneImage } from "@/server/pipeline/generate-scene-image";
import { prisma } from "@/server/db/client";

const connection = getRedisConnection();

const projectGenerateWorker = new Worker<ProjectGenerateJobData>(
  "project-generate",
  async (job) => {
    const sceneIds = await runProjectGeneration(job.data.projectId);

    const queue = getSceneImageQueue();
    for (const sceneId of sceneIds) {
      await queue.add(
        "generate-scene-image",
        { sceneId, projectId: job.data.projectId },
        { removeOnComplete: 100, removeOnFail: 100 }
      );
      await prisma.scene.update({ where: { id: sceneId }, data: { imageStatus: "QUEUED" } });
    }
  },
  { connection }
);

const sceneImageWorker = new Worker<SceneImageJobData>(
  "scene-image",
  async (job) => {
    await runGenerateSceneImage(job.data.sceneId);
    await markProjectReadyIfComplete(job.data.projectId);
  },
  { connection }
);

for (const worker of [projectGenerateWorker, sceneImageWorker]) {
  worker.on("failed", (job, err) => {
    console.error(`[worker] job ${job?.id} (${job?.queueName}) failed:`, err.message);
  });
  worker.on("completed", (job) => {
    console.log(`[worker] job ${job.id} (${job.queueName}) completed`);
  });
}

console.log("Generation worker started — listening on queues: project-generate, scene-image");

process.on("SIGTERM", async () => {
  await Promise.all([projectGenerateWorker.close(), sceneImageWorker.close()]);
  process.exit(0);
});
